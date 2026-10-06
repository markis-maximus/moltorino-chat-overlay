# Moltorino Chat Overlay

A transparent Twitch chat overlay that runs from one file on your computer. It shows Twitch, FFZ, BTTV, and 7TV emotes, including FFZ effects and 7TV layers. You do not need to sign in to Twitch.

[![CI](https://github.com/markis-maximus/moltorino-chat-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/markis-maximus/moltorino-chat-overlay/actions/workflows/ci.yml)

## Put your own chat in OBS

This is the easiest way. Nothing else needs to stay open besides OBS.

1. [Download `chat-channelname.html`](https://github.com/markis-maximus/moltorino-chat-overlay/releases/latest/download/chat-channelname.html).
2. Rename the file. Replace `channelname` with your Twitch name. For example, Twitch channel `jynxzi` would use `chat-jynxzi.html`.
3. In OBS, add a new **Browser** source.
4. Turn on **Local file**, then choose the renamed file.
5. Set the width to **800** and the height to **500**.

That is all. Your live chat should appear when someone sends a message. The file reads public chat only. It cannot send messages, and it does not need your Twitch password or login.

Keep the filename in this form:

```text
chat-your_twitch_name.html
```

Capital letters do not matter. Keep any underscores that are part of the Twitch name. Internet access is still needed to read Twitch chat and load emotes and badges.

## See the effects before going live

[Download `chat-channelname-preview.html`](https://github.com/markis-maximus/moltorino-chat-overlay/releases/latest/download/chat-channelname-preview.html), rename it the same way, and select it as an OBS local file. It shows labeled example messages along with the live chat. The examples stay on your computer and are never posted to Twitch.

## Optional setup page

The setup page gives you controls for text size, emote size, message count, fade time, badges, names, paints, and example messages. Use it only if you want those extra choices.

1. Download and extract the ZIP from [GitHub Releases](https://github.com/markis-maximus/moltorino-chat-overlay/releases/latest).
2. On Windows, double-click `start-overlay.cmd`. On macOS or Linux, open the extracted folder in a terminal and run `./start-overlay.sh`.
3. Open **http://127.0.0.1:18765/** in a browser.
4. Enter the Twitch channel and download the finished HTML file.

The setup page requires Node.js 18 or newer. The one-file method above does not. If your streaming software accepts only a web address, keep the setup page running and use the address it gives you.

FFmpeg by itself cannot display an HTML overlay. An FFmpeg setup needs a browser layer that can show the file.

## Supported effects

| Input | Result |
| --- | --- |
| `ppL ffzW` | Wide |
| `ppL ffzX` / `heyy ffzY` | Horizontal / vertical flip |
| `ppL ffzJam` | Jam animation |
| `ppL ffzBounce` | Bounce and squish |
| `ppL ffzSpin` | Rotation |
| `ppL ffzRainbow` | Animated hue shift |
| `ppL ffzHyper` | Red filter and shake |
| `ppL ffzCursed` | Dark, high-contrast grayscale |
| `ppL ffzArrive` / `heyy ffzLeave` | Arrival / departure animation |
| `ppL ffzSlide` | Repeating horizontal slide |
| `ppL ffzW ffzRainbow ffzBounce` | Combined width, color, and motion |
| `ppL JailTime ffzW` | 7TV layer and base widen together, when JailTime is enabled |

Any recognized Twitch, FFZ, BTTV or 7TV base emote can be modified. `ppL` is a default global 7TV emote. For another channel, use an emote enabled there. A chain attaches to the preceding emote; intervening ordinary text breaks it. Repeating the same effect does not multiply it. Arrive+Leave forms a six-second sequence. In v0.2.0, Spin, Shake, Jam, Bounce, and arrival/departure have independent nested animation stages. `WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW` therefore spins, bounces, transitions, and stays wide. Slide also composes with Spin. This deliberately extends FFZ's shared CSS transform behavior; exact Moltorino frame timing is unverified. Detailed provenance and rules are in [research/ffz.md](research/ffz.md).

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
node build.mjs --channel={channelname}
node server.mjs
```

Build outputs are in `dist/`. There are no runtime npm dependencies; Playwright is a development-only dependency. The offline browser suite starts its own loopback test server. Optional live/provider checks are separate because they depend on current public services. Windows, macOS, and Linux run the unit and offline browser suites in GitHub Actions. Provider schemas, sources, and read-only connection evidence are in [research/providers.md](research/providers.md).

Please report reproducible problems through [GitHub Issues](https://github.com/markis-maximus/moltorino-chat-overlay/issues) with the channel, exact message text, browser-source dimensions, and whether you used localhost or a standalone HTML file. Do not include Twitch OAuth tokens or private account data.

Original overlay code is MIT licensed. Adapted FFZ keyframes are Apache-2.0 licensed; attribution and license text are included in each standalone file. Emote images retain their owners' rights.
