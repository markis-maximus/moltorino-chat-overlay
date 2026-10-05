(function (root) {
  'use strict';

  // Retain successful public endpoint responses across refreshes during transient outages.
  const endpointCache = new Map();

  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    if (value.startsWith('//')) value = 'https:' + value;
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
    catch (_) { return ''; }
  }

  async function getJSON(url, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const abort = () => controller.abort();
    if (signal) signal.addEventListener('abort', abort, {once: true});
    try {
      const response = await fetch(url, {signal: controller.signal, credentials: 'omit'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }

  function add(map, record) {
    if (!record || !record.name || !record.url) return;
    map.set(record.name, record);
  }

  function bttv(data, map) {
    const items = Array.isArray(data) ? data : [].concat(data && data.channelEmotes || [], data && data.sharedEmotes || []);
    for (const item of items) {
      if (!item || !item.id || !item.code) continue;
      add(map, {
        id: String(item.id), name: item.code, provider: 'bttv',
        url: 'https://cdn.betterttv.net/emote/' + encodeURIComponent(item.id) + '/3x',
        width: Number(item.width) || 0, height: Number(item.height) || 0,
        zeroWidth: Boolean(item.modifier)
      });
    }
  }

  function ffz(data, map, global) {
    if (!data || !data.sets) return;
    const defaultIds = new Set((data.default_sets || []).map(String));
    for (const [setId, set] of Object.entries(data.sets)) {
      for (const item of set.emoticons || []) {
        if (global && Array.isArray(data.default_sets) && !defaultIds.has(setId) && !item.modifier && !item.modifier_flags && !item.modifier_prefix) continue;
        const urls = item.animated || item.urls || {};
        const url = safeUrl(urls['4'] || urls['2'] || urls['1']);
        add(map, {
          id: String(item.id), name: item.name, provider: 'ffz', url,
          width: Number(item.width) || 28, height: Number(item.height) || 28,
          zeroWidth: Boolean(item.modifier) || (Number(item.modifier_flags) & 1) !== 0,
          modifier: Boolean(item.modifier),
          modifierFlags: Number(item.modifier_flags) || 0,
          modifierPrefix: Boolean(item.modifier_prefix),
          modifier_flags: Number(item.modifier_flags) || 0,
          modifier_prefix: Boolean(item.modifier_prefix),
          fallbackUrl: safeUrl(item.urls && (item.urls['4'] || item.urls['2'] || item.urls['1']))
        });
      }
    }
  }

  function sevenTV(data, map) {
    if (!data) return;
    const set = data.emote_set || data;
    for (const active of set.emotes || []) {
      const emote = active.data || active;
      const host = emote.host || {};
      const files = host.files || [];
      const file = files.find(file => file.name === '3x.webp') || files.find(file => file.name === '2x.webp') ||
        files.find(file => file.format === 'WEBP') || files.find(file => file.name === '3x.png') || files[0];
      if (!file || !host.url) continue;
      const small = files.find(file => /^1x\./.test(file.name)) || file;
      const base = safeUrl(host.url);
      if (!base) continue;
      // 256 belongs to the emote's data.flags, not the active alias flags.
      add(map, {
        id: String(emote.id || active.id), name: active.name || emote.name, provider: '7tv',
        url: base.replace(/\/$/, '') + '/' + encodeURIComponent(file.name),
        width: Number(small.width) || 32, height: Number(small.height) || 32,
        zeroWidth: (Number(emote.flags) & 256) !== 0
      });
    }
  }

  function twitchBadges(data, map) {
    for (const badge of Array.isArray(data) ? data : []) {
      for (const version of badge.versions || []) {
        const url = safeUrl(version.image_url_4x || version.image_url_2x || version.image_url_1x);
        if (badge.set_id && version.id && url) map.set(badge.set_id + '/' + version.id, url);
      }
    }
  }
  function channelBadges(room,map){
    if(!room)return;
    const pick=x=>typeof x==='string'?safeUrl(x):safeUrl(x?.['4']||x?.['2']||x?.['1']);
    const mod=pick(room.mod_urls)||pick(room.moderator_badge);
    const vip=pick(room.vip_urls)||pick(room.vip_badge);
    if(mod)map.set('moderator/1',{url:mod,color:'#34ae0a'});
    if(vip)map.set('vip/1',vip);
  }

  async function load(channel, onStatus) {
    const name = String(channel || '').trim().replace(/^#/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(name)) throw new Error('Invalid Twitch channel login.');
    const emotes = new Map(), badges = new Map(), failures = [];
    function report(state, message) {
      if (typeof onStatus === 'function') {
        try { onStatus({state, message}); } catch (_) { /* Status UI must not block loading. */ }
      }
    }
    async function optional(label, url) {
      try {
        const data = await getJSON(url);
        endpointCache.set(url, data);
        return data;
      }
      catch (error) {
        failures.push(label);
        const cached = endpointCache.has(url);
        report('warning', label + ' unavailable (' + (error.name === 'AbortError' ? 'timeout' : error.message) + ').' + (cached ? ' Using the last loaded data.' : ''));
        return cached ? endpointCache.get(url) : null;
      }
    }
    report('loading', 'Loading public emotes for #' + name + '…');
    const [ffzGlobal, bttvGlobal, sevenGlobal, room, globalBadges] = await Promise.all([
      optional('FFZ global emotes', 'https://api.frankerfacez.com/v1/set/global'),
      optional('BTTV global emotes', 'https://api.betterttv.net/3/cached/emotes/global'),
      optional('7TV global emotes', 'https://7tv.io/v3/emote-sets/global'),
      optional('FFZ channel data', 'https://api.frankerfacez.com/v1/room/' + encodeURIComponent(name)),
      optional('Global Twitch badges', 'https://api.ivr.fi/v2/twitch/badges/global')
    ]);
    // Deterministic precedence: channel emotes override globals; 7TV then FFZ then BTTV win aliases within a scope.
    bttv(bttvGlobal, emotes);
    ffz(ffzGlobal, emotes, true);
    sevenTV(sevenGlobal, emotes);
    twitchBadges(globalBadges, badges);
    let channelId = room && room.room && room.room.twitch_id ? String(room.room.twitch_id) : '';
    if (!channelId) {
      const users = await optional('Twitch channel lookup', 'https://api.ivr.fi/v2/twitch/user?login=' + encodeURIComponent(name));
      channelId = Array.isArray(users) && users[0] && users[0].id ? String(users[0].id) : '';
    }
    if (channelId && /^\d+$/.test(channelId)) {
      const [bttvChannel, sevenChannel, channelBadges] = await Promise.all([
        optional('BTTV channel emotes', 'https://api.betterttv.net/3/cached/users/twitch/' + channelId),
        optional('7TV channel emotes', 'https://7tv.io/v3/users/twitch/' + channelId),
        optional('Channel Twitch badges', 'https://api.ivr.fi/v2/twitch/badges/channel?id=' + channelId)
      ]);
      bttv(bttvChannel, emotes);
      ffz(room, emotes, false);
      sevenTV(sevenChannel, emotes);
      twitchBadges(channelBadges, badges);
    } else {
      channelId = '';
      ffz(room, emotes, false);
      report('warning', 'Could not resolve the Twitch channel ID. Global emotes remain available.');
    }
    channelBadges(room?.room,badges);
    report(failures.length ? 'warning' : 'loaded', emotes.size + ' emotes loaded' + (failures.length ? '; some providers are unavailable.' : '.'));
    return {channelId, emotes, badges, failures};
  }

  root.OverlayProviders = Object.freeze({load, parsers: Object.freeze({bttv, ffz, sevenTV, twitchBadges,channelBadges})});
})(typeof window !== 'undefined' ? window : globalThis);
