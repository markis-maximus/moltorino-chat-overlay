# Verification — 2026-10-05

Verified from local source files, public provider APIs, and newly launched headless Chromium. No existing desktop browser session or native application was controlled. No chat messages or moderation actions were sent.

- Installed Moltorino identity: M15.5.2, source commit `e0966a622a3475dbaada167603797638e77e8a18`.
- All 12 named FFZ modifiers confirmed in its binary and in FFZ's public global metadata.
- 22 Node test entries passed: 14 renderer/parser tests, seven cosmetics tests, and the transport/provider test group.
- 13 final offline Chromium checks passed, including actual animation progress, 36→72px widening, widening of stacked 7TV layers, HTML injection resistance, deletion/clears, and image-failure fallback.
- Local URL and standalone `file://` sources both established an anonymous Twitch connection. The final generated standalone preview loaded 590 emote aliases and decoded all 21 images across 18 demo emote groups.
- The generated HTML download retained the chosen channel and text size, ran without external script/style files or the local HTTP server, and had a transparent body.
- The generator, standalone preview, and effects were visually inspected from headless browser screenshots.
- Unknown image dimensions were exercised with a 96×32 base; applying `ffzW` reached FFZ's correct 128px cap at 1× scale.

The live source defaults to `markis_maximus`, inferred from the supplied screenshots. Internet connectivity and provider uptime are still required. OBS itself was not opened or tested. Rendering uses FFZ's published definitions; exact pixel equality with Moltorino's native renderer is not claimed.

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
- A165-second read-only Bonnie sample received49 messages from11 users and12 public7TV dispatches. Metadata showed actual paints,7TV badges, and channel moderator/VIP badge replacements. No chat message bodies are included in the distribution.
- Real public assets for Djrr13, ZincOC, TheBRGbot, and a separate MoltoBenne reference rendered and decoded. This exercised gradients, repeating gradients, FFZ custom mod/VIP images,7TV badges, and Moltorino badges. Cosmetic updates preserved emote nodes and animation clocks.
- Full production app integration passed for both localhost and standalone Bonnie sources: anonymous Twitch connection,1,111 emote aliases, live7TV connection, public paint/badge lookup, decoded images, and independent Spin/Bounce/Arrive+Leave. Test-only injection supplied the exact WW text locally; nothing was sent to chat.
- The setup form and downloadable standalone export passed again with chosen font size26 and a transparent background.

Local test reports are in `test-results/`. The live cosmetics replay test uses the locally captured `research/snapshots/bonnie-live.json`; captured payloads and screenshots are intentionally excluded from the shareable ZIP. `tests/app-cosmetics-live.cjs` checks current public data without that fixture. Public user selections and channel assets can change after verification.

## v0.2.1 Homies badges and moderator backgrounds

`tests/homies-browser.cjs` loads the production app from localhost and an exported Bonnie HTML file. In both:

- moonie142 and Karma_SL receive the exact Chatterino Homies images supplied by the user, resolved from the provider's public assignments.
- Each badge renders four distinct animation frames across four captures.
- The custom moderator icon and StreamElements' FFZ bot replacement have green backgrounds, computed as `rgb(52, 174, 10)`.
- Repeated unchanged cosmetic updates preserve badge image nodes.
- No page errors occur.

The seven cosmetics unit tests additionally cover malformed/unsafe registry data, cache retention during outages, and the distinction between a moderator bot's green background and a non-moderator bot's provider background. All22 Node tests and all13 existing browser checks pass. Public reference source files, badge registries, and observation snapshots remain excluded from the ZIP.

## v0.2.2 animated overflow and message history

The reported aggressive loss of older messages was reproduced before changing production code. At36px emote size, a plain emote, Wide emote, and30 stacked7TV layers all had the same41px row height and retained nine messages. The WW Spin/Bounce/Arrive/Leave/Wide chain and the all-FFZ chain kept that same row height, but animated overflow increased the container's scrollHeight beyond its500px viewport. The old trimming loop consequently removed all eight older rows even though doing so could not eliminate overflow beneath the newest row.

The fix measures row layout heights plus gaps and container padding instead of scrollHeight. Emote parsing, reserved emote dimensions, animation frames, and compositing remain unchanged. The before-fix report is retained locally as `test-results/layout-before.json`.

`tests/layout-regression.cjs --assert` compares84 combinations of plain/Wide,30 stacked7TV layers, the WW chain, and all twelve FFZ modifiers at36px/72px sizes and seven animation phases. It also checks retention after the next ordinary message. All cases pass after the fix, on both localhost and the exported Bonnie file. Narrow and wide viewport cases confirm truly wrapped messages still remove older rows as needed, retaining an oversized newest message. The same test can target an exported file through `OVERLAY_TEST_URL`. All22 Node tests and13 existing browser checks also pass after the change.
