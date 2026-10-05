# Moltorino Chat Overlay

A portable, transparent Twitch chat browser source with FFZ effects, 7TV zero-width layers, FFZ/BTTV/7TV channel emotes, and Twitch message emotes. No Twitch login or remotely hosted overlay is required. Internet access is still needed for Twitch chat and emote providers.

[![CI](https://github.com/markis-maximus/moltorino-chat-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/markis-maximus/moltorino-chat-overlay/actions/workflows/ci.yml)

## Download and run

Download the latest release from [GitHub Releases](https://github.com/markis-maximus/moltorino-chat-overlay/releases/latest), extract the ZIP, and choose one of these methods:

- **Windows:** double-click `start-overlay.cmd`.
- **macOS or Linux:** open a terminal in the extracted folder and run `./start-overlay.sh`. If the ZIP extractor removed its executable bit, run `chmod +x start-overlay.sh` once.
- **Any OS with Node.js:** run `npm start` or `node server.mjs`.

Node.js 18 or newer is required for the setup server. It has no runtime packages to install. Open [http://127.0.0.1:18765/overlay.html?channel=](http://127.0.0.1:18765/overlay.html?channel=), enter a Twitch channel, and either copy the localhost browser-source URL or download a self-contained HTML overlay.

The downloaded HTML needs no server and no Node.js. In OBS, add **Browser**, enable **Local file**, select the HTML, and use a size such as **800 × 500**. The same file works with other Chromium/CEF-based broadcast tools that accept a local HTML browser source.

## Try it in OBS

The optional local server uses port 18765. With it running, add a **Browser** source, set its size to **800 × 500**, and paste:

```text
http://127.0.0.1:18765/overlay.html?channel=jynxzi&demo=1
```

You will see labeled local preview messages demonstrating all twelve FFZ effects, while the source also reads the channel's live chat. The previews are never sent to Twitch. Remove `&demo=1` for live chat without the preview, and replace the example channel with any Twitch channel.

The setup page at **http://127.0.0.1:18765/** lets you change the channel, text and emote sizes, message limit, fade time, badges, names, username paints, and preview messages. It generates a source URL or downloads a self-contained HTML file. 

## Use or share it without a server

1. Select **Browser → Local file** in OBS.
2. Choose `dist/chat-{channelname}-preview.html` to immediately see the effects, or `dist/chat-{channelname}.html` for live chat only. To create another channel's files, run `npm run build -- --channel=your_channel`.
3. Set the source size to 800 × 500 or your preferred dimensions.

The HTML includes its CSS, JavaScript, FFZ keyframes, and preview image. You can send that one file to another streamer. Use the setup page first to download a file configured for their channel; no Node.js or server is needed to run the downloaded file. In other Chromium/CEF-based streaming tools, load the HTML file as a transparent browser layer. FFmpeg itself does not execute HTML: a custom FFmpeg pipeline needs a browser renderer/capture stage to provide the overlay frames.

If your software only accepts URLs, start the optional local server with `start-overlay.cmd` on Windows, `start-overlay.sh` on macOS/Linux, or `node server.mjs`. It listens only on 127.0.0.1. It must remain running while a localhost URL source is in use. No startup task, OBS configuration change, or public server is installed.

## Supported effects

| Input | Result |
| --- | --- |
| `heyy ffzW` | Wide |
| `heyy ffzX` / `heyy ffzY` | Horizontal / vertical flip |
| `heyy ffzJam` | Jam animation |
| `heyy ffzBounce` | Bounce and squish |
| `heyy ffzSpin` | Rotation |
| `heyy ffzRainbow` | Animated hue shift |
| `heyy ffzHyper` | Red filter and shake |
| `heyy ffzCursed` | Dark, high-contrast grayscale |
| `heyy ffzArrive` / `heyy ffzLeave` | Arrival / departure animation |
| `heyy ffzSlide` | Repeating horizontal slide |
| `heyy ffzW ffzRainbow ffzBounce` | Combined width, color, and motion |
| `heyy JailTime ffzW` | 7TV layer and base widen together, when JailTime is enabled |

Any recognized Twitch, FFZ, BTTV or 7TV base emote can be modified. `heyy` is enabled in the default channel. For another channel, use an emote enabled there. A chain attaches to the preceding emote; intervening ordinary text breaks it. Repeating the same effect does not multiply it. Arrive+Leave forms a six-second sequence. In v0.2.0, Spin, Shake, Jam, Bounce, and arrival/departure have independent nested animation stages. `WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW` therefore spins, bounces, transitions, and stays wide. Slide also composes with Spin. This deliberately extends FFZ's shared CSS transform behavior; exact Moltorino frame timing is unverified. Detailed provenance and rules are in [research/ffz.md](research/ffz.md).

## Username paints and badges

The overlay supports 7TV username paints and badges, Moltorino badges, Chatterino Homies custom animated badges, FFZ user badges, and a channel's custom FFZ moderator/VIP badge images. Custom moderator badges have a green background; an FFZ bot badge replacing a moderator icon keeps that background. Public Moltorino badge selection, ordering, and hidden categories are applied. Paints include gradients, repeating gradients, image backgrounds, and shadows. These load asynchronously and update visible names and badges without restarting emote animations. Unchanged badge images also retain their animation state across cosmetic updates. Set `paints=0` to disable paints or `badges=0` to hide badges.

7TV live events provide cosmetic updates; public user lookups also load an active paint/badge when a chatter appears. Moltorino, FFZ, and Chatterino Homies badge registries refresh every five minutes. A short initial delay or an unavailable provider can leave a plain name or omit an extra badge. No Twitch login is required. See [research/cosmetics.md](research/cosmetics.md) for the verified sources and limitations.

History trimming measures actual message rows, excluding the painted area of animated effects. Stacking more FFZ motions or 7TV layers on one emote therefore does not consume extra rows by itself. Wide emotes and genuinely wrapped text can still require more room.

## Future modifiers

The overlay reloads public emote catalogs every five minutes. It reads FFZ's `modifier_flags` and `modifier_prefix`, including effect sets outside `default_sets`. Newly published modifier names and combinations of known effects work without a code change. Unrecognized effect bits remain visible as text instead of silently disappearing. A brand-new animation algorithm requires a renderer update; no renderer can infer it from an unfamiliar flag alone. Updating the source files requires rebuilding any previously exported standalone HTML.

## Verification and scope

The twelve names were confirmed in the installed Moltorino M15.5.2 binary and FFZ's global API. Animation definitions come from FFZ's official source. Tests cover modifier parsing, actual rendered dimensions, animation progress, 7TV layer composition, native Twitch Unicode offsets, public provider loading, reconnect protocol, chat deletions, user/chat clears, safe text rendering, and generated standalone files. Validation uses a separate headless Chromium; OBS itself and other streaming applications were not controlled or tested.

This is a focused implementation, not a full ChatIS clone. It does not implement 7TV personal emote entitlements or non-Twitch platforms. FFZ effects modify the whole composited image here. Exact pixel parity with Moltorino's native renderer is unverified because source matching its installed build was unavailable.

## Development

Use Node.js 20 or newer for the development test dependencies.

```text
npm install
npx playwright install chromium
npm test
npm run test:browser
node build.mjs --channel=your_channel
node server.mjs
```

Build outputs are in `dist/`. There are no runtime npm dependencies; Playwright is a development-only dependency. The offline browser suite starts its own loopback test server. Optional live/provider checks are separate because they depend on current public services. Windows, macOS, and Linux run the unit and offline browser suites in GitHub Actions. Provider schemas, sources, and read-only connection evidence are in [research/providers.md](research/providers.md).

Please report reproducible problems through [GitHub Issues](https://github.com/markis-maximus/moltorino-chat-overlay/issues) with the channel, exact message text, browser-source dimensions, and whether you used localhost or a standalone HTML file. Do not include Twitch OAuth tokens or private account data.

Original overlay code is MIT licensed. Adapted FFZ keyframes are Apache-2.0 licensed; attribution and license text are included in each standalone file. Emote images retain their owners' rights.
