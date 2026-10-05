(function (root) {
  'use strict';

  function channelName(value) {
    const name = String(value || '').trim().replace(/^#/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(name)) throw new Error('Enter a Twitch channel login, without a URL.');
    return name;
  }

  function unescapeTag(value) {
    const escapes = {s: ' ', ':': ';', r: '\r', n: '\n', '\\': '\\'};
    return String(value || '').replace(/\\(.)|\\$/g, function (_, char) {
      return char ? (Object.prototype.hasOwnProperty.call(escapes, char) ? escapes[char] : char) : '';
    });
  }

  function parseLine(line) {
    let remaining = String(line).replace(/\r$/, '');
    const result = {tags: Object.create(null), prefix: '', command: '', params: []};
    if (remaining[0] === '@') {
      const end = remaining.indexOf(' ');
      if (end < 0) return null;
      for (const pair of remaining.slice(1, end).split(';')) {
        const equal = pair.indexOf('=');
        const name = equal < 0 ? pair : pair.slice(0, equal);
        result.tags[name] = equal < 0 ? '' : unescapeTag(pair.slice(equal + 1));
      }
      remaining = remaining.slice(end + 1).replace(/^ +/, '');
    }
    if (remaining[0] === ':') {
      const end = remaining.indexOf(' ');
      if (end < 0) return null;
      result.prefix = remaining.slice(1, end);
      remaining = remaining.slice(end + 1).replace(/^ +/, '');
    }
    const commandEnd = remaining.indexOf(' ');
    result.command = (commandEnd < 0 ? remaining : remaining.slice(0, commandEnd)).toUpperCase();
    if (!result.command) return null;
    remaining = commandEnd < 0 ? '' : remaining.slice(commandEnd + 1).replace(/^ +/, '');
    while (remaining) {
      if (remaining[0] === ':') {
        result.params.push(remaining.slice(1));
        break;
      }
      const end = remaining.indexOf(' ');
      if (end < 0) {
        result.params.push(remaining);
        break;
      }
      result.params.push(remaining.slice(0, end));
      remaining = remaining.slice(end + 1).replace(/^ +/, '');
    }
    return result;
  }

  // IRC emote offsets are inclusive Unicode code point indexes, not UTF-16 indexes.
  function parseEmotes(value, textLength) {
    const emotes = [];
    for (const group of String(value || '').split('/')) {
      const colon = group.indexOf(':');
      if (colon < 1) continue;
      const id = group.slice(0, colon);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) continue;
      for (const range of group.slice(colon + 1).split(',')) {
        const match = /^(\d+)-(\d+)$/.exec(range);
        if (!match) continue;
        const start = Number(match[1]), end = Number(match[2]);
        if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && end < textLength) {
          emotes.push({id, start, end});
        }
      }
    }
    emotes.sort((a, b) => a.start - b.start || a.end - b.end);
    return emotes;
  }

  function toMessage(irc) {
    if (!irc || irc.command !== 'PRIVMSG' || irc.params.length < 2) return null;
    const tags = irc.tags;
    let text = irc.params[1];
    const isAction = text.startsWith('\x01ACTION ') && text.endsWith('\x01');
    if (isAction) text = text.slice(8, -1);
    const username = irc.prefix.split('!')[0] || tags.login || '';
    const sent = Number(tags['tmi-sent-ts']);
    return {
      id: tags.id || '',
      channel: irc.params[0].replace(/^#/, ''),
      text,
      displayName: tags['display-name'] || username,
      username,
      userId: tags['user-id'] || '',
      color: /^#[\da-f]{6}$/i.test(tags.color || '') ? tags.color : '',
      badges: String(tags.badges || '').split(',').filter(Boolean).map(value => {
        const [set, version = ''] = value.split('/');
        return {set, version};
      }),
      emotes: parseEmotes(tags.emotes, Array.from(text).length),
      isAction,
      timestamp: Number.isFinite(sent) && sent > 0 ? sent : Date.now(),
      tags
    };
  }

  function connect(channel, handlers) {
    const name = channelName(channel);
    handlers = handlers || {};
    let socket = null, stopped = false, retryTimer = null, watchdog = null, retry = 0;
    const seen = new Set();
    function emit(kind, value) {
      if (typeof handlers[kind] === 'function') {
        try { handlers[kind](value); } catch (error) { console.error('Overlay callback:', error); }
      }
    }
    function status(state, message) { emit('onStatus', {state, message}); }
    function schedule() {
      if (stopped || retryTimer !== null) return;
      const wait = Math.min(30000, 1000 * Math.pow(2, retry++)) + Math.floor(Math.random() * 350);
      status('reconnecting', 'Chat disconnected. Reconnecting in ' + Math.ceil(wait / 1000) + 's…');
      retryTimer = setTimeout(() => { retryTimer = null; open(); }, wait);
    }
    function open() {
      if (stopped) return;
      status('connecting', 'Connecting to #' + name + '…');
      const nick = 'justinfan' + (100000 + Math.floor(Math.random() * 900000));
      let current;
      try { current = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); }
      catch (_) { schedule(); return; }
      socket = current;
      let joined = false;
      let pending = '';
      function sendProtocol(text) {
        if (current.readyState === 1) current.send(text + '\r\n');
      }
      current.onopen = () => {
        if (stopped || socket !== current) return current.close();
        sendProtocol('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        sendProtocol('PASS SCHMOOPIIE');
        sendProtocol('NICK ' + nick);
        sendProtocol('JOIN #' + name);
        watchdog = setTimeout(() => { if (!joined) current.close(); }, 20000);
      };
      current.onmessage = event => {
        if (stopped || current !== socket || typeof event.data !== 'string') return;
        pending += event.data;
        if (pending.length > 1024 * 1024) { pending = ''; current.close(); return; }
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) {
          const irc = parseLine(line);
          if (!irc) continue;
          if (irc.command === 'PING') {
            sendProtocol('PONG :' + (irc.params[0] || 'tmi.twitch.tv'));
          } else if (irc.command === 'RECONNECT') {
            current.close();
          } else if (irc.command === 'ROOMSTATE' || irc.command === '366') {
            if (!joined) {
              joined = true;
              retry = 0;
              clearTimeout(watchdog);
              watchdog = null;
              status('connected', 'Reading #' + name);
            }
          } else if (irc.command === 'PRIVMSG') {
            const message = toMessage(irc);
            if (!message || message.channel !== name) continue;
            if (message.id && seen.has(message.id)) continue;
            if (message.id) {
              seen.add(message.id);
              if (seen.size > 1000) seen.delete(seen.values().next().value);
            }
            emit('onMessage', message);
          } else if (irc.command === 'CLEARCHAT' && irc.params[0] === '#' + name) {
            emit('onClear', {
              userId: irc.tags['target-user-id'] || '',
              username: irc.params[1] || '',
              all: !irc.params[1] && !irc.tags['target-user-id']
            });
          } else if (irc.command === 'CLEARMSG' && irc.params[0] === '#' + name) {
            emit('onDelete', {id: irc.tags['target-msg-id'] || ''});
          } else if (irc.command === 'NOTICE') {
            status('notice', irc.params[irc.params.length - 1] || 'Twitch sent a notice.');
          }
        }
      };
      current.onerror = () => {
        status('error', 'Unable to reach Twitch chat. Retrying…');
        current.close();
      };
      current.onclose = () => {
        if (socket !== current) return;
        clearTimeout(watchdog);
        watchdog = null;
        socket = null;
        schedule();
      };
    }
    open();
    return {
      close() {
        stopped = true;
        clearTimeout(retryTimer);
        clearTimeout(watchdog);
        retryTimer = watchdog = null;
        if (socket) socket.close();
        socket = null;
      }
    };
  }

  root.OverlayTransport = Object.freeze({connect, parseLine, toMessage, parseEmotes, channelName});
})(typeof window !== 'undefined' ? window : globalThis);
