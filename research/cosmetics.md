# Cosmetics evidence — updated 2026-10-09

This implementation reads public endpoints without account credentials. It never sends chat, moderation commands, cosmetic mutations, or presence announcements.

## Providers

- [Moltorino public badge registry](https://api.moltorino.com/v2/badges): schemaVersion 2; definitions in `badges`, assignments and preferences in `users`, category order in `layout.defaultOrder`. The overlay reads activeBadge, order, and hidden. An explicit null activeBadge means no selected Moltorino badge. Source verification now establishes that `decorations: false` suppresses Homies custom badges independently of 7TV paints. See the [pinned source audit and comparison cases](moltorino-semantics.md) for exact mappings and selection rules.
- FFZ room responses can publish custom moderator images in `mod_urls` and VIP images in `vip_badge`. These replace corresponding Twitch badge images when a channel provides them.
- [FFZ user badges](https://api.frankerfacez.com/v1/badges/ids): badge definitions and Twitch user assignments. Following the native Moltorino provider, global FFZ badges display separately from Twitch roles; its provider does not use `replaces` metadata.
- [7TV public Twitch-user endpoint](https://7tv.io/v3/users/twitch/227313621): active cosmetic IDs in `user.style`. The overlay looks up chatters by their IRC user-id and caches results.
- [7TV GraphQL endpoint](https://7tv.io/v3/gql): read-only `cosmetics(list: ...)` query retrieves paint and badge definitions. Paints contain packed RGBA colors, gradients or image URLs, stops, and shadows; badges contain CDN host/file information.
- `wss://events.7tv.io/v3`: subscriptions to `cosmetic.*` and `entitlement.*`, conditioned on platform TWITCH and channel ID, provide live updates. Entitlements are joined to Twitch IDs through the user's connections. Heartbeats and reconnects are handled.
- [Chatterino badges](https://api.chatterino.com/badges), [FFZ:AP supporters](https://api.ffzap.com/v1/supporters), [Bluzyrino badges](https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges), [Homies supporters](https://itzalex.github.io/badges), and [Homies staff](https://itzalex.github.io/badges2) now supply their native categories. Public registry parsing and one actual image per provider passed in a standalone-file Chromium check on October 9. FFZ:AP sends its CORS response when the request has an Origin header, including `null` for a local file.
- [BetterTTV live updates](https://betterttv.com/developers/websocket) at `wss://sockets.betterttv.net/ws`: the overlay subscribes to the channel and receives `lookup_user` badge URLs. It never sends `broadcast_me`; availability depends on other clients' announcements.
- Shared Chat origin pictures use the public IVR user lookup by Twitch ID. Source roles use global Twitch assets rather than the destination channel's custom images. Source metadata and badge sets come from Twitch IRC tags; the overlay does not guess channel relationships.

Refreshes preserve cached data on failure and reject malformed Moltorino metadata, older bundles in the same generation, and older in-flight responses. Paint and badge assignment updates are tracked independently; later live definition changes take precedence over delayed lookups. Category-level Moltorino assignments and last-valid Homies duplicate assignments are supported. Source rules and limits are detailed in the [follow-up report](moltorino-semantics.md#local-follow-up--2026-10-09).

Moltorino M15.5.2's executable contains a `MoltorinoPaintByID` GraphQL query using 7TV's cosmetic paint fields, along with the public badge endpoint. This is concrete evidence that its vanity UI uses 7TV paint data. It does not prove exact rendering parity or every preference's behavior. No authentication settings were read.

[ChatIS source](https://github.com/IS2511/ChatIS-v2/blob/main/v2/script.js) was inspected as a protocol comparison. The cosmetics module was independently implemented; the downloaded reference source and observation payloads are excluded from the distribution.

## Observed and rendered

A 165-second anonymous sample of an active reference channel received 49 messages from 11 users and 12 public 7TV dispatches. Only identity/badge metadata and cosmetic events were retained for local verification, not message bodies. Examples:

- Djrr13: Ghoulish paint, England 7TV badge, Moltorino supporter badge, and FFZ badge.
- ZincOC: Electric paint and a channel-specific custom VIP badge.
- TheBRGbot: a channel-specific custom moderator badge.

All those badge images decoded in Chromium. Public MoltoBenne data additionally exercised North Star's repeating gradient and developer badge. The October 9 correction composites gradient stops over the username color, stretches URL paints, measures radial radius, and applies native default large-shadow radii. CSS drop-shadow kernels still differ from Qt, and some paints produce strong glows.

The full production app was separately tested on localhost and as a standalone file. Both connected anonymously to an active channel, loaded 1,111 emote aliases, and fetched/rendered Djrr13's paint and 7TV/Moltorino badges without replaying captured events. A local test-only injection supplied neutral emote text; it was never sent to Twitch. The exact WW modifier chain had independently active Spin, Bounce, and Arrive/Leave animations with a nonzero rotation matrix.

## v0.2.1 badge follow-up

The exact animated images reported for moonie142 and Karma_SL are assigned by the [Chatterino Homies public registry](https://chatterinohomies.com/api/badges/list), not 7TV. Entries match Twitch user IDs657457116 and705840357 and supply image1/image2/image3 URLs. The overlay now loads those assignments, preserving the animated WebP assets, with cached data retained during an outage. These custom badges use Moltorino's `hc` ordering category.

[FFZ's official badge renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/badges.jsx) explicitly applies `#34ae0a` behind custom moderator images and leaves custom VIP images transparent. The overlay carries this background alongside the custom image URL. The initial v0.2.1 implementation replaced a moderator badge with a green FFZ bot icon. The source audit corrects this: the green moderator badge and gray global FFZ bot badge now appear separately, in `ta` and `ff` respectively.

Unchanged badge profiles preserve their existing image nodes rather than replacing them during every cosmetic update. This avoids repeatedly restarting animated badge images. In the historical v0.2.1 check, both supplied Homies assets produced four distinct captured frames in each mode. Updated offline cases confirm the moderator background remains RGB52,174,10 and the separate FFZ bot background uses RGB89,89,89.

## Remaining limits

Public services can be delayed or unavailable. Live cosmetics and per-user lookup complement each other; the overlay does not claim access to private cosmetic state. Pixel parity with Moltorino, its GIF-dependent transition timing, native account/local settings, and 7TV personal emote entitlements remain outside this verification. Provider coverage is listed above rather than implying support for every badge service. Updating cosmetic decorations preserves the existing emote DOM and animation clocks. Chromium, Firefox and WebKit were tested on Windows; actual Mac/Linux, Safari and OBS runs remain unverified for these changes.
