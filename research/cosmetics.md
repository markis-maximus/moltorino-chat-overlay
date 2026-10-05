# Cosmetics evidence — 2026-10-05

This implementation reads public endpoints without account credentials. It never sends chat, moderation commands, cosmetic mutations, or presence announcements.

## Providers

- [Moltorino public badge registry](https://api.moltorino.com/v2/badges): schemaVersion 2; definitions in `badges`, assignments and preferences in `users`, category order in `layout.defaultOrder`. The overlay reads activeBadge, order, and hidden. An explicit null activeBadge means no selected Moltorino badge. The `decorations: false` field is conservatively interpreted as hiding paint; its complete native semantics have not been established.
- [Bonnie's FFZ room](https://api.frankerfacez.com/v1/room/bonnie): channel ID 485587109, custom moderator images in `mod_urls`, VIP images in `vip_badge`. These replace corresponding Twitch badge images.
- [FFZ user badges](https://api.frankerfacez.com/v1/badges/ids): badge definitions and Twitch user assignments, including replacement semantics.
- [7TV public Twitch-user endpoint](https://7tv.io/v3/users/twitch/227313621): active cosmetic IDs in `user.style`. The overlay looks up chatters by their IRC user-id and caches results.
- [7TV GraphQL endpoint](https://7tv.io/v3/gql): read-only `cosmetics(list: ...)` query retrieves paint and badge definitions. Paints contain packed RGBA colors, gradients or image URLs, stops, and shadows; badges contain CDN host/file information.
- `wss://events.7tv.io/v3`: subscriptions to `cosmetic.*` and `entitlement.*`, conditioned on platform TWITCH and channel ID, provide live updates. Entitlements are joined to Twitch IDs through the user's connections. Heartbeats and reconnects are handled.

Moltorino M15.5.2's executable contains a `MoltorinoPaintByID` GraphQL query using 7TV's cosmetic paint fields, along with the public badge endpoint. This is concrete evidence that its vanity UI uses 7TV paint data. It does not prove exact rendering parity or every preference's behavior. No authentication settings were read.

[ChatIS source](https://github.com/IS2511/ChatIS-v2/blob/main/v2/script.js) was inspected as a protocol comparison. The cosmetics module was independently implemented; the downloaded reference source and observation payloads are excluded from the distribution.

## Observed and rendered

A 165-second anonymous sample of Bonnie received 49 messages from 11 users and 12 public 7TV dispatches. Only identity/badge metadata and cosmetic events were retained for local verification, not message bodies. Examples:

- Djrr13: Ghoulish paint, England 7TV badge, Moltorino supporter badge, and FFZ badge.
- ZincOC: Electric paint and Bonnie's custom VIP badge.
- TheBRGbot: Bonnie's custom moderator badge.

All those badge images decoded in Chromium. Public MoltoBenne data additionally exercised North Star's repeating gradient and developer badge. Paint shadows are applied as the published CSS drop-shadows; some produce strong glows.

The full production app was separately tested on localhost and as a standalone file. Both connected anonymously to Bonnie, loaded 1,111 emote aliases, and fetched/rendered Djrr13's paint and 7TV/Moltorino badges without replaying captured events. A local test-only injection supplied neutral emote text; it was never sent to Twitch. The exact WW modifier chain had independently active Spin, Bounce, and Arrive/Leave animations with a nonzero rotation matrix.

## v0.2.1 badge follow-up

The exact animated images reported for moonie142 and Karma_SL are assigned by the [Chatterino Homies public registry](https://chatterinohomies.com/api/badges/list), not 7TV. Entries match Twitch user IDs657457116 and705840357 and supply image1/image2/image3 URLs. The overlay now loads those assignments, preserving the animated WebP assets, with cached data retained during an outage. These custom badges use Moltorino's `hc` ordering category.

[FFZ's official badge renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/badges.jsx) explicitly applies `#34ae0a` behind custom moderator images and leaves custom VIP images transparent. The overlay now carries this background alongside the custom image URL. FFZ's global bot definition uses gray; this overlay deliberately keeps the moderator green when the bot image replaces a moderator badge, so StreamElements' role remains visible. A bot without moderator status retains the provider's own background.

Unchanged badge profiles now preserve their existing image nodes rather than replacing them during every cosmetic update. This avoids repeatedly restarting animated badge images. Both supplied Homies assets produced four distinct captured frames in each of the localhost and standalone tests; the custom moderator and StreamElements bot backgrounds both computed to RGB52,174,10.

## Remaining limits

Public services can be delayed or unavailable. Live cosmetics and per-user lookup complement each other; the overlay does not claim access to private cosmetic state. Pixel parity with Moltorino, its GIF-dependent transition timing, other providers' custom badge systems, and 7TV personal emote entitlements remain outside this verification. Updating cosmetic decorations preserves the existing emote DOM and animation clocks.
