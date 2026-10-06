# Changelog

## 0.2.5 — 2026-10-06

- Use one standalone download for both preview and live chat.
- Show four short opening examples built from global `ppL`, `RainTime`, and FFZ modifiers, then remove them automatically after 20 seconds.
- Remove the separate preview download.

## 0.2.4 — 2026-10-06

- Let a standalone overlay get its Twitch channel from its filename. Rename `chat-channelname.html` to `chat-yourname.html` and load it as a local browser source.
- Put the one-file, no-server OBS setup first in the README and move the optional setup server into its own section.

## 0.2.3 — 2026-10-05

- Use `{channelname}` for copyable documentation examples and Jynxzi as the shipped public reference channel.
- Remove personal and former reference-channel names from runtime defaults, generated overlays, tests, and research tools.
- Preserve the standard green background when a moderator badge uses a custom Twitch or FFZ replacement image.

## 0.2.2 — 2026-10-05

- Compose FFZ Spin, Shake, Jam, Bounce, Slide, Arrive, Leave, Wide, flips, and filters without one motion cancelling another.
- Render 7TV paints and badges, Moltorino badges, FFZ and Chatterino Homies badges, and channel-specific moderator/VIP images.
- Preserve animated badges and emotes when live cosmetic data refreshes.
- Keep FFZ animation overflow from incorrectly removing older chat messages.
- Provide standalone HTML overlays and a loopback-only setup server.

See [VERIFICATION.md](VERIFICATION.md) for test evidence and known limits.
