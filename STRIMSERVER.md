# Strimserver integration

This guide is based on the public [`ChronicCmposer/strimserver`](https://github.com/ChronicCmposer/strimserver) `dev` branch reviewed on October 6, 2026.

## Where the overlay belongs

Strimserver's documented stream path is:

```text
local OBS scene → Unix socket → local FFmpeg encoder → encrypted SRT → Strimserver → Twitch
```

Add the chat HTML to the local OBS scene. OBS draws the browser source into the outgoing picture before the Unix-socket and SRT stages, so the rest of Strimserver carries it like any other part of the video.

The cloud-side Strimserver images do not contain a browser. Their FFmpeg stages normalize, scale, encode, record, and forward an existing video feed. Copying the HTML into those containers would not display it.

## Setup

1. Download [`chat-channelname.html`](https://github.com/markis-maximus/moltorino-chat-overlay/releases/latest/download/chat-channelname.html).
2. Rename it `chat-chroniccmposer.html`.
3. In the OBS scene that feeds Strimserver, add **Browser**.
4. Enable **Local file** and select `chat-chroniccmposer.html`.
5. Use **800 × 500** initially, then position and resize the source for the scene.
6. Start the existing local encoder and Strimserver workflow normally.

No Twitch login, Strimserver configuration field, container image change, or FFmpeg filter is required. The computer running OBS needs internet access to Twitch chat and the public emote and cosmetic providers.

## Platform coverage

OBS Browser Source uses its own Chromium engine. A selected local file is exposed internally through an `http://absolute/...` address. The overlay recognizes Windows drive paths, macOS `/Users/...` paths, and Linux `/home/...` paths in that format. Automated tests cover all three address shapes.

The repository's CI also runs its Chromium rendering, parser, modifier, and standalone build checks on Windows, macOS, and Linux. This establishes source compatibility; an end-to-end stream through ChronicCmposer's live machines has not been performed here.

## FFmpeg-only use

A pipeline that bypasses OBS needs a browser renderer to turn the transparent HTML page into video frames. Those frames can then be composited with FFmpeg before SRT ingest. Strimserver does not currently include that renderer, so this is a separate integration rather than a file-copy setup.
