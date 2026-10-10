# Moltorino badge and paint rules — source audit, 2026-10-08

The overlay now follows the verified rules below for its supported providers. This corrects the earlier inference that `decorations` disables 7TV paint.

## Evidence and scope

The reference is [EEVA-inc/Moltorino7 at commit `2c98aaf8004842e7a25ff8aa07a362f9056c51b3`](https://github.com/EEVA-inc/Moltorino7/tree/2c98aaf8004842e7a25ff8aa07a362f9056c51b3), linked as source by Moltorino's website. These are source-based comparisons; the native executable was not launched or rebuilt. The repository's CMake version says 15.5.1; the previously inspected installed executable reported 15.5.2. An exact source-to-installed-binary match is not established.

The public [v2 registry](https://api.moltorino.com/v2/badges) snapshot had generation `074cdd7e442fbda2`, bundle version `910`, and generation time `2026-10-09T03:17:53.976Z` (October 8 in Chicago). It contained nine badge definitions and 337 user records. Thirty-nine records had `hidden`; none had `decorations`. Decorations behavior is therefore verified from source and synthetic cases, not claimed as an observed live opt-out.

## Badge categories

Categories and individual IDs serve different purposes: `m` orders Moltorino badges; `supporter_plus` selects one assigned Moltorino badge. The overlay uses explicit registry image URLs and tooltips, without guessing artwork from priorities or abbreviated IDs.

| Category | Meaning | Overlay coverage |
|---|---|---|
| `ta` | Twitch roles: staff, admin, global moderator, lead moderator, moderator, VIP, broadcaster | Loaded |
| `ts` | Twitch subscriber and founder | Loaded |
| `tv` | Other Twitch badge sets, including bits, premium, partner and event badges | Loaded |
| `tp` | Exactly the Twitch `predictions` set | Loaded |
| `c` | Chatterino | Loaded |
| `ff` | Global FrankerFaceZ badges | Loaded |
| `fa` | FFZ:AP | Loaded |
| `bt` | BetterTTV badges | Live channel subscription; depends on incoming user announcements |
| `bl` | Bluzyrino | Loaded |
| `m` | Moltorino | Loaded |
| `7` | 7TV badges | Loaded |
| `hc` | Homies custom badges | Loaded |
| `hs` | Homies supporter and staff badges | Both lists loaded |

The old overlay incorrectly put VIP in `tv` and most other Twitch badges in `ta`. It also treated `predictions*` as predictions; native code matches only `predictions`. Unknown Twitch sets fall into `tv`. See [TwitchBadge.cpp](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/twitch/TwitchBadge.cpp#L46-L64) and [VanityDialog category labels](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/widgets/dialogs/VanityDialog.cpp#L5765-L5835).

Channel FFZ moderator/VIP images remain Twitch roles in `ta`. Global FFZ badges are separate badges in `ff`, sorted by numeric FFZ ID. Moltorino's global provider does not use FFZ's `replaces` metadata. The overlay now shows a green moderator role beside the separate gray FFZ bot badge, instead of replacing the role with a green bot icon. Hiding one category leaves the other available. See [custom role images](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L546-L578), [FFZ ingestion](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/ffz/FfzBadges.cpp#L60-L197), and [FFZ rendering](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L3550-L3562).

## Moltorino badge selection

The provider preserves assignment order; the message builder displays its first result. Numeric `priority` does not select that result. `listed` affects the vanity catalog, not whether an assigned badge can appear in chat. See [assignment parsing](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L407-L450), [selection](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L899-L943), and [rendering one badge](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L3673-L3698).

| Input | Result |
|---|---|
| No `activeBadge` | First valid assignment |
| `activeBadge` names an assigned badge | That badge |
| `activeBadge` is null, empty, whitespace, or a non-string | No Moltorino badge |
| Nonempty `activeBadge` is unknown or unassigned | First valid assignment |
| `hidden` contains `m` | No visible Moltorino badge, regardless of selection |
| Assigned definition has `listed: false` | Still eligible for display |

IDs are trimmed and lowercased; duplicate assignments preserve precedence; unknown definitions are skipped. Native definitions require a nonempty 1x image. The overlay additionally requires HTTPS, uses higher-resolution images when available, and preserves asset query strings.

For example, public record `40254420` assigns `[founder, supporter]` without a choice. The expected badge is `founder`; the old priority rule displayed `supporter`. A selection audit across all 337 captured records found **23 mismatches before and zero after** against the source-derived rule. This measures Moltorino badge selection, not every pixel or provider in those profiles.

## Order and visibility

A remote layout exists only when a user record contains `order`, `hidden`, or `activeBadge`. Without one, native code preserves initial badge order: Twitch badges in message order, Chatterino, global FFZ, FFZ:AP, BetterTTV, Bluzyrino, Moltorino, 7TV, then Homies custom, supporter and staff.

When a layout exists:

- Absent `order` uses `layout.defaultOrder`. An explicitly empty or non-array `order` normalizes from the native base order.
- String keys are trimmed and lowercased. Invalid and duplicate keys are discarded; at most 64 valid distinct input keys are considered.
- Missing categories are filled in. Missing `fa` goes immediately after `ff`; missing `bl` goes immediately before `m`.
- Legacy `t:<set>` keys map to Twitch categories. If any occur in an order, mentioned Twitch categories move to the front in `ta, ts, tv, tp` order, ahead of other requested categories.
- Legacy hidden keys hide the **whole category**: `t:vip` hides `ta`, including moderator; `t:bits` hides `tv`, including premium.
- Badges sharing a category preserve their relative order.

See [key parsing](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L66-L111), [normalization](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L518-L640), and [application to rendered badges](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L3418-L3548).

## Decorations and paints

Only Boolean `decorations: false` disables decorations. In the pinned source, the production consumer is Homies custom-badge rendering. It suppresses the custom badge; Homies supporter badges, 7TV badges, Moltorino badges, and username paints retain their independent controls. See [policy parsing](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L242-L254) and [Homies rendering](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L3628-L3671).

The native client exempts the signed-in user's own messages. The anonymous overlay has no signed-in account and follows the non-self rule; channel ownership does not create a self exemption. See [decorationsEnabledForUser](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L1044-L1054).

7TV paint rendering has its own setting and lookup ([MessageLayoutElement.cpp](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/layouts/MessageLayoutElement.cpp#L2181-L2219)). The overlay's **Show username paints** remains its paint switch. **Show badges** independently hides badges; hiding `7` hides the 7TV badge, not paint.

## Repeatable comparisons

- `tests/fixtures/moltorino-rules.json`: source provenance and hand-reviewed category, layout, and selection expectations, including branches absent from today's registry.
- `tests/fixtures/moltorino-public-v2.json`: nine actual badge definitions and four unchanged public preference records with expected selections. The other 333 records are excluded.
- `tests/moltorino-semantics.test.cjs`: 50 focused tests covering mappings, asset URLs, selection, ordering, visibility, decorations typing, missing 1x images and FFZ role separation.
- `tests/moltorino-browser.cjs`: eight comparisons in each of localhost and standalone file modes. Checks paint CSS, badge presence/order, role/bot background colors, independent display switches, decoded fixture images, and preservation of unchanged badge nodes. These use intercepted data and synthetic images.

Run `npm test`, then `npm run test:browser`. The browser runner rebuilds the portable files and launches a separate headless instance. Chromium is the default; `OVERLAY_BROWSER=firefox` or `webkit` selects another installed Playwright engine. Reports and comparison screenshots go to ignored `test-results/`. No chat or cosmetic changes are sent to providers.

## Local follow-up — 2026-10-09

The six follow-up areas were addressed locally as follows:

1. **Registry freshness.** Invalid schema/generation/bundle metadata preserves the last usable registry. Lower bundles in the same generation and late responses from older requests cannot replace newer data. A new generation may reset its bundle number. Provider refreshes are independently guarded; closing the service prevents pending refreshes from changing state. This follows the intent of native [payload validation](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/moltorino/MoltorinoSupporterBadges.cpp#L1343); it does not duplicate the client's bootstrap/version negotiation or disk cache.
2. **7TV update races.** Paint and badge assignments have separate revisions, so a live update to one does not discard the other's lookup result. Definition updates/deletes invalidate older in-flight definition reads. Closed services discard delayed results.
3. **Paint semantics.** Zero/one-stop gradients retain the username color or composite their single RGBA stop over it. URL paints stretch across the name. Radial paints use half the larger name dimension, including a post-insertion geometry pass. All valid stops and shadows are retained. Shadow radii follow the native default large-shadow multiplier of three; CSS and Qt blur kernels still differ. References: [paint implementations](https://github.com/EEVA-inc/Moltorino7/tree/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/seventv/paints) and [paint parser](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers/seventv/SeventvPaints.cpp).
4. **Provider coverage and Shared Chat.** Added the providers marked loaded above. Chatterino/Homies category assignments keep the last valid assignment; FFZ:AP follows its colored flag and special labels; Bluzyrino uses catalog precedence and atomic validation, including sixteen distinct badges per user. BetterTTV only subscribes with `join_channel`; it never broadcasts an identity. Shared Chat keeps an origin portrait outside vanity slots and adds source moderator/VIP/lead-moderator roles before current-channel badges, deduplicating exact set/version matches. See the pinned [provider implementations](https://github.com/EEVA-inc/Moltorino7/tree/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/providers), [Shared Chat construction](https://github.com/EEVA-inc/Moltorino7/blob/2c98aaf8004842e7a25ff8aa07a362f9056c51b3/src/messages/MessageBuilder.cpp#L610), and [BetterTTV subscription documentation](https://betterttv.com/developers/websocket).
5. **Compatibility parsing.** Moltorino category-level array/object assignments are merged before root assignments, preserving inherited Boolean false decorations. Trimmed blank image URLs fall back correctly. Homies custom duplicate users keep their last valid assignment and require a 1x image.
6. **Verification.** Added concurrency, parser, rendering and Shared Chat regression cases. The browser runner now rebuilds both tracked portable files; the old example file had been stale. Full suites pass in Chromium, Firefox and WebKit on Windows. A separate Chromium `file://` check fetched all five new static registries and decoded a real badge asset from each. BetterTTV incoming badge behavior is covered by protocol replay, not a claim that a real badge announcement was observed in this run.

New comparisons are in `tests/cosmetics-hardening.test.cjs`, `tests/badge-providers.test.cjs`, `tests/shared-chat.test.cjs`, and `tests/cosmetics-rendering.cjs`. The opt-in live check is `tests/public-badge-providers.cjs`. See [verification results](../VERIFICATION.md) for counts and reproducible commands.

## Remaining differences

These checks establish the listed rules against a pinned source revision, not complete native-client or pixel parity. Native local overrides, the signed-in self exemption, and native disk cache/bootstrap protocols are not reproduced. The overlay accepts root and category-level assignments, uses HTTPS-only images, and retains its five-minute registry refresh schedule. Shared Chat metadata uses a bounded public lookup cache; the initial generic origin symbol is this project's own artwork.

Comparison assumes custom layouts and relevant badge/paint display settings are enabled in Moltorino. Paint rasterization, glow bounds, GIF-dependent modifier timing and URL-paint animation timing still need native visual comparisons before claiming identical appearance. This run did not launch the installed client, establish its exact source revision, run OBS, or execute on macOS/Linux. Browser-engine coverage on Windows does not remove those limits.
