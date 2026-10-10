# Verification — 2026-10-05

## Eight review findings repaired — 2026-10-10 (unreleased)

All eight findings from the [second review](research/review-20261010.md) now have local fixes and regression checks. The [repair report](research/repairs-20261010.md) records each change and its validation. Both portable HTML files and the standalone template were rebuilt. Nothing was committed, pushed, or released.

- **110 Node tests pass**, including 14 new tests for supported USERNOTICE content, Shared Chat notice rules, malformed provider isolation/cache retention, socket timeouts, stale callbacks, synchronous connection failures, and shutdown.
- **The full offline browser suite passes in Chromium, Firefox, and WebKit on Windows.** The added repair checks exercise both source scripts and the rebuilt portable `file://` download: late Slide layer dimensions and preserved animation clocks, static fallback and double image failure, individual badge preservation/reordering/failure isolation, same-ID radial paint revisions, and overlapping app refreshes. Parsed resubscription content also reaches the production app with its emote and subscription flag.
- **Controlled connection tests deliberately omit browser close events.** Twitch handshake/join deadlines, idle recovery and keepalive reset; BetterTTV handshake/renewal; and 7TV hello timeout reconnect themselves. This verifies application behavior without claiming a physical network outage was reproduced.
- **Live renamed portable file:** an isolated Chromium session connected anonymously to Jynxzi, loaded 984 emote aliases, connected to 7TV, and loaded 348 Moltorino user preference records at 2026-10-10T06:58:00Z. FFZ channel data and BTTV channel emotes returned HTTP 404; those failures did not block the other providers. No user paint/badge assignment was observed in this short check. No public chat messages or moderation commands were sent.

Run `npm test` and `npm run test:browser`. Set `OVERLAY_BROWSER` to `firefox` or `webkit` to repeat the full browser suite in another installed engine. The repair-specific browser cases also run with `node tests/review-regressions.cjs --assert` after `npm run build`.

Ignored local evidence: `test-results/repairs-node.txt`, `repairs-{chromium,firefox,webkit}.txt`, `repairs-20261010-{chromium,firefox,webkit}.json`, `repairs-before.txt`, and `repairs-live-file.json`. Actual OBS, Safari, native Moltorino rendering, macOS/Linux execution and physical network interruption were not tested. No existing desktop app or browser session was controlled.

## Local follow-up — 2026-10-09 (unreleased)

The previously identified follow-up gaps now have local fixes and comparison cases. Registry freshness, per-field 7TV updates, delayed cosmetic definitions, category-level assignments, duplicate Homies assignments, paint geometry, additional badge providers, and Shared Chat source badges are covered. See [the source report](research/moltorino-semantics.md#local-follow-up--2026-10-09) for exact behavior and primary-source links.

- **96 Node tests pass**, including 24 additional tests since the initial source audit. Three new definition-race tests failed before their fix and pass afterward.
- **The full offline browser suite passes in Chromium, Firefox and WebKit on Windows.** It covers the existing setup, filename channel detection, modifier stacking and message-history regressions; eight mapping/display comparisons in both modes; and new provider rendering, Shared Chat, single-stop color, URL stretch, measured radial geometry, forty gradient stops and eight shadows in both modes. The modes are localhost and portable `file://`.
- **Live public-provider check:** Chromium 153.0.8010.12 loaded five registries directly from `file://` and decoded a representative real asset from each: Chatterino (4,601 assigned users), FFZ:AP (125), Bluzyrino (99), Homies supporter (947) and Homies staff (10). This was checked at 2026-10-09T20:30:53Z; assignments and availability can change. No proxy, login or server was used.
- **Artifact correction:** the tracked Jynxzi example still contained version 0.2.6. The build now regenerates it alongside the generic download and template, and browser tests rebuild before testing. Both portable artifacts now contain the current source.
- **BetterTTV:** deterministic tests verify `join_channel`, incoming `lookup_user`, order/visibility and shutdown. This follow-up did not observe a real user's BetterTTV badge announcement. Native client settings, exact Qt rasterization, OBS, and actual macOS/Linux execution were not tested. WebKit on Windows is not the Safari application.

Run `npm test` and `npm run test:browser`. For another engine, first install with `npx playwright install firefox webkit`, then set `OVERLAY_BROWSER` to `firefox` or `webkit` and rerun the browser command. Run `node tests/public-badge-providers.cjs` separately for the opt-in live check.

Local reports are `test-results/hardening-node.txt`, `hardening-{chromium,firefox,webkit}.txt`, `cosmetics-rendering-{chromium,firefox,webkit}.json`, and `public-badge-providers.json`. Mapping screenshots are `moltorino-{engine}-{mode}.png`. These reports are ignored by Git. Existing browser/client sessions were not controlled. Nothing was committed, pushed or released.

## Local source audit — 2026-10-08 (unreleased)

The [Moltorino semantics report](research/moltorino-semantics.md) pins public native source and documents corrections to Twitch category mapping, Moltorino badge selection, layout normalization, global FFZ role separation, and decorations handling. Its rules supersede the historical green bot replacement described below.

The initial comparison run had 25 failures among 42 new cases; subsequent checks also reproduced global FFZ role replacement and invalid badge-definition selection before those corrections. Final coverage includes 50 new semantics tests within 72 passing Node tests, plus eight rendered comparisons in each of localhost and standalone Chromium modes. The full existing offline browser suite also passes. This run is local Windows validation; macOS/Linux CI was not triggered and the native executable was not exercised.

A source-derived selection audit of public bundle 910 found 23 disagreements across 337 user records before the fix and zero after. Nine definitions and four representative user records are retained as deterministic fixtures. `decorations` was absent from this snapshot, so its false/true/missing/non-Boolean branches use synthetic inputs grounded in native code.

Local reports: `test-results/moltorino-snapshot-audit.json`, `test-results/moltorino-browser.json`, and `test-results/moltorino-localhost.png` / `moltorino-standalone.png`. The portable template and `dist/chat-channelname.html` were rebuilt with the corrected rules and source-license attribution. Nothing was committed, pushed or released as part of this audit.

## Historical checks

Verified from local source files, public provider APIs, and newly launched headless Chromium. No existing desktop browser session or native application was controlled. No chat messages or moderation actions were sent.

- Installed Moltorino identity: M15.5.2, source commit `e0966a622a3475dbaada167603797638e77e8a18`.
- All 12 named FFZ modifiers confirmed in its binary and in FFZ's public global metadata.
- 22 Node test entries passed: 14 renderer/parser tests, seven cosmetics tests, and the transport/provider test group.
- 13 final offline Chromium checks passed, including actual animation progress, 36→72px widening, widening of stacked 7TV layers, HTML injection resistance, deletion/clears, and image-failure fallback.
- Local URL and standalone `file://` sources both established an anonymous Twitch connection. The final generated standalone preview loaded 590 emote aliases and decoded all 21 images across 18 demo emote groups.
- The generated HTML download retained the chosen channel and text size, ran without external script/style files or the local HTTP server, and had a transparent body.
- The generator, standalone preview, and effects were visually inspected from headless browser screenshots.
- Unknown image dimensions were exercised with a 96×32 base; applying `ffzW` reached FFZ's correct 128px cap at 1× scale.

The live source defaults to `jynxzi` as a high-activity public reference channel. Replace it with the intended Twitch channel. Internet connectivity and provider uptime are still required. OBS itself was not opened or tested. Rendering uses FFZ's published definitions; exact pixel equality with Moltorino's native renderer is not claimed.

Hyper and Cursed can turn a dark image almost black; the implemented filters match FFZ's source. The preview uses the brighter Kappa image for those two examples so their effect is visible.

New provider aliases and combinations of known effect bits are read automatically. Entirely new effect algorithms require a code update and regeneration of exported HTML files.

Primary-source links and implementation details are in `research/ffz.md`, `research/providers.md`, and `research/cosmetics.md`.

## v0.1.1 stacking correction

An additional deterministic browser test reproduced a collision when Arrive+Leave shared a CSS transform with Bounce (and in a longer chain with Jam, Rainbow, Spin, Slide, and Hyper). The later transform animation replaced the arrival/departure animation. Arrive+Leave alone worked in either token order.

The fix gives arrival/departure its own nested animation stage. The regression test now checks hidden, arriving, visible, leaving, and hidden phases at five points in the six-second cycle, both alone and in larger stacks. All four chains pass. The existing 13 offline browser checks still pass.

The actual `LMAO` emote from this channel (`01K7K1Q8Z265XTE5QRES259F2W`) was loaded and tested with Arrive, Leave, and both together. With both, its rendered width progressed from zero to 14.4px to 48px to 33.6px before disappearing at a 48px display size. Cancellation with only the pair was not reproduced in Chromium. Native Moltorino GIF-dependent timing remains unverified. The transition clock is deliberately independent of the image's animation duration.

`demo=1` keeps the live connection enabled and adds local sample rows. Removing it only suppresses those rows.

## v0.2.0 simultaneous motion and cosmetics

- The exact `WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW` regression was reproduced before the fix: Spin's computed rotation was zero and the nominal32px base remained32px wide. After independent animation stages and removal of the Spin-specific width limit, Spin's matrix component was -0.5 at2375ms, Bounce remained active, and layout width was64px. All four Arrive/Leave stack regression cases pass.
- A165-second read-only active-channel sample received49 messages from11 users and12 public7TV dispatches. Metadata showed actual paints,7TV badges, and channel moderator/VIP badge replacements. No chat message bodies are included in the distribution.
- Real public assets for Djrr13, ZincOC, TheBRGbot, and a separate MoltoBenne reference rendered and decoded. This exercised gradients, repeating gradients, FFZ custom mod/VIP images,7TV badges, and Moltorino badges. Cosmetic updates preserved emote nodes and animation clocks.
- Full production app integration passed for both localhost and standalone active-channel sources: anonymous Twitch connection,1,111 emote aliases, live7TV connection, public paint/badge lookup, decoded images, and independent Spin/Bounce/Arrive+Leave. Test-only injection supplied the exact WW text locally; nothing was sent to chat.
- The setup form and downloadable standalone export passed again with chosen font size26 and a transparent background.

Local test reports are in `test-results/`. Captured payloads and screenshots are intentionally excluded from the shareable ZIP. `tests/app-cosmetics-live.cjs` checks current public data without a captured chat fixture. Public user selections and channel assets can change after verification.

## v0.2.1 Homies badges and moderator backgrounds

`tests/homies-browser.cjs` loads the production app from localhost and an exported Jynxzi HTML file. In both:

- moonie142 and Karma_SL receive the exact Chatterino Homies images supplied by the user, resolved from the provider's public assignments.
- Each badge renders four distinct animation frames across four captures.
- The custom moderator icon and StreamElements' FFZ bot replacement have green backgrounds, computed as `rgb(52, 174, 10)`.
- Repeated unchanged cosmetic updates preserve badge image nodes.
- No page errors occur.

The seven cosmetics unit tests additionally cover malformed/unsafe registry data, cache retention during outages, and the distinction between a moderator bot's green background and a non-moderator bot's provider background. All22 Node tests and all13 existing browser checks pass. Public reference source files, badge registries, and observation snapshots remain excluded from the ZIP.

## v0.2.2 animated overflow and message history

The reported aggressive loss of older messages was reproduced before changing production code. At36px emote size, a plain emote, Wide emote, and30 stacked7TV layers all had the same41px row height and retained nine messages. The WW Spin/Bounce/Arrive/Leave/Wide chain and the all-FFZ chain kept that same row height, but animated overflow increased the container's scrollHeight beyond its500px viewport. The old trimming loop consequently removed all eight older rows even though doing so could not eliminate overflow beneath the newest row.

The fix measures row layout heights plus gaps and container padding instead of scrollHeight. Emote parsing, reserved emote dimensions, animation frames, and compositing remain unchanged. The before-fix report is retained locally as `test-results/layout-before.json`.

`tests/layout-regression.cjs --assert` compares84 combinations of plain/Wide,30 stacked7TV layers, the WW chain, and all twelve FFZ modifiers at36px/72px sizes and seven animation phases. It also checks retention after the next ordinary message. All cases pass after the fix, on both localhost and an exported channel file. Narrow and wide viewport cases confirm truly wrapped messages still remove older rows as needed, retaining an oversized newest message. The same test can target an exported file through `OVERLAY_TEST_URL`. All22 Node tests and13 existing browser checks also pass after the change.
