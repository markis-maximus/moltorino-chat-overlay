# Public provider and transport checks

Checked 2026-10-05 without launching or controlling any desktop application, reading saved accounts, or sending chat messages.

## Endpoint checks

All endpoint checks below returned HTTP 200. Requests included `Origin: null` to check whether a `file://` browser source is accepted. FFZ and IVR replied with `Access-Control-Allow-Origin: *`; BTTV and 7TV reflected `null`. No account token is needed.

| Provider | Endpoint | Observed schema |
| --- | --- | --- |
| FFZ global | https://api.frankerfacez.com/v1/set/global | `default_sets`, `sets[id].emoticons` |
| FFZ channel | https://api.frankerfacez.com/v1/room/markis_maximus | `room.twitch_id` is `95463358`; room emote sets |
| BTTV global | https://api.betterttv.net/3/cached/emotes/global | Array of emotes with `id`, `code`, optional dimensions and `modifier` |
| BTTV channel | https://api.betterttv.net/3/cached/users/twitch/95463358 | `channelEmotes` and `sharedEmotes` |
| 7TV global | https://7tv.io/v3/emote-sets/global | Active emotes with alias `name`, `data.flags`, and `data.host.files` |
| 7TV channel | https://7tv.io/v3/users/twitch/95463358 | `emote_set.emotes`; current IDs include ULIDs, so no fixed hex length assumed |
| IVR channel fallback | https://api.ivr.fi/v2/twitch/user?login=markis_maximus | Array, user `id` and `login` |
| IVR global badges | https://api.ivr.fi/v2/twitch/badges/global | Array of badge sets and versions, with Twitch CDN image URLs |
| IVR channel badges | https://api.ivr.fi/v2/twitch/badges/channel?id=95463358 | Array of badge sets; empty for this channel |

IVR is a public third-party Twitch data mirror, used only for optional badge data and channel ID fallback. The legacy `badges.twitch.tv` hostname failed DNS resolution during this check; it is not used. Twitch emotes use the emote IDs and ranges supplied with each IRC message, so the overlay does not need an authenticated Twitch emote-catalog call.

FFZ's live global API publishes twelve modifier emotes and flags: `ffzW=9`, `ffzX=3`, `ffzY=5`, `ffzSlide=17`, `ffzArrive=33`, `ffzLeave=65`, `ffzSpin=129`, `ffzRainbow=2049`, `ffzHyper=12289`, `ffzCursed=16385`, `ffzJam=32769`, `ffzBounce=65537`. The provider preserves `modifierFlags` and `modifierPrefix` rather than guessing effects from the emote name. Modifiers with new names but supported flags can therefore be picked up from the live API.

## Chat transport

[Twitch's IRC documentation](https://dev.twitch.tv/docs/chat/irc/) documents the secure WebSocket address, IRCv3 tags, emote ranges, and the ACTION wrapper handling. The implementation uses `wss://irc-ws.chat.twitch.tv:443` with an anonymous `justinfan` nickname and requests tags, commands, and membership capabilities. Its outgoing messages are limited to `CAP`, anonymous `PASS`, `NICK`, `JOIN`, and `PONG`. There is no send-chat API or `PRIVMSG` call.

The parser retains inclusive emote ranges as Unicode code point indexes, strips the `\x01ACTION ` wrapper before rendering, unescapes IRCv3 tags, handles multiple lines or partial lines, and delivers message deletions and per-user/channel chat clears. It reconnects with bounded exponential backoff and suppresses recently repeated message IDs.

A live anonymous connection to `markis_maximus` completed and received Twitch `ROOMSTATE`/join confirmation, then closed immediately. No user chat content was retained and no messages or moderation actions were sent. The complete live catalog loaded 589 emote aliases and 520 badge variants, including the actual `heyy` emote (`01FN25QCP000071FCSB63SB4G4`) and all twelve FFZ modifier descriptors, with zero failed provider requests.

Provider loading is best effort with a ten-second timeout per request. Global provider calls run concurrently, followed by channel data once the Twitch ID is known. Each successful endpoint response is retained in memory and reused if a later refresh fails. Endpoint-specific keys keep one channel's cached emotes out of another channel's catalog. Channel emotes override global aliases; 7TV takes priority over FFZ and BTTV within each scope. All returned FFZ global sets contribute modifier definitions, including sets omitted from `default_sets`. All remote images use HTTPS. No remote CSS or JavaScript from emote metadata is executed.

`transport.test.cjs` uses mocked sockets and provider records to check Unicode ranges, ACTION messages, IRC escapes, partial frames, read-only outgoing protocol, reconnection cleanup, moderation events, current provider schemas, FFZ flags, and 7TV zero-width flags.
