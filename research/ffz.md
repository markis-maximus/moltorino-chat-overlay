# FFZ modifier evidence and compatibility

Verified 2026-10-05 through files, executable strings, and public HTTP endpoints. No desktop interaction or chat action was used.

## Primary evidence

- [FFZ global emote metadata](https://api.frankerfacez.com/v1/set/global): all twelve named effects below are published here with `modifier: true` and `modifier_flags`. Set 1539687 is named Emote Effects. Set 1532818 is named Subwoofer Emote Effects. The latter appears in `sets` but is not in `default_sets` in the fetched response. The overlay deliberately understands all twelve rather than treating the default set list as the list of renderable effects.
- [Official effect implementation](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/emotes.js), source definitions around lines20–369 and CSS composition around1168–1226. Latest commit touching this file returned by GitHub: `1d046fca2b6fa40a0185c50e2c1ab2cae4613692`.
- [Official tokenizer and sizing](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/tokenizers.jsx), sizing around1316–1405, modifier binding around1820–1948.
- [Official license](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/LICENSE): Copyright 2016 Dan Salvato LLC, Apache License2.0. `modifiers.js` adapts the effect values and frames with changes described below. Include this notice and an Apache2.0 license copy when redistributing.
- The inspected `%LOCALAPPDATA%\MoltoBenne.Moltorino7\current\Moltorino7.exe` includes all twelve literal names and reads `modifier_flags` / `modifier_prefix` provider metadata. ASCII names appear near file offsets `0x1fb27d0`–`0x1fb2948`. This verifies vocabulary support, not pixel-level rendering equivalence.
- [Moltorino's public source repository](https://codeberg.org/MoltoBenne/Moltorino) still returned head `29b05dbde4f932fc1808614422b723d0a038db35`. Fetching the installed build's source commit `e0966a622a3475dbaada167603797638e77e8a18` returned404. Therefore this overlay follows verifiable FFZ source; exact native Moltorino parity has not been established.

## Vocabulary and behavior

The `flags` value includes bit1, which hides the modifier's separate icon when successfully attached to a preceding emote.

| Token | Flags | FFZ emote ID | Effect |
|---|---:|---:|---|
| ffzW |9|723890|Double image width, subject to FFZ size caps|
| ffzX |3|720508|Horizontal reflection|
| ffzY |5|720509|Vertical reflection|
| ffzSpin |129|723886|360° rotation over1.5seconds; the overlay allows stacking with Slide|
| ffzArrive |33|723888|3second appear sequence|
| ffzLeave |65|723887|3second leave sequence|
| ffzSlide |17|723889|Repeating leftward image scroll; period0.5×rendered-width/32 seconds at1×size|
| ffzRainbow |2049|720510|Hue rotation over2seconds|
| ffzHyper |12289|Red filter plus0.1second shake|
| ffzCursed |16385|Grayscale, brightness0.7, contrast2.5|
| ffzJam |32769|0.6second position/rotation sequence|
| ffzBounce |65537|0.5second squish/flip sequence, origin bottom-center|

Hyper filter: `brightness(0.2) sepia(1) brightness(2.2) contrast(3) saturate(8)`. Exact appear/leave, jam, shake and bounce frames are preserved in `modifiers.js`.

## Binding and combination rules

FFZ suffix modifiers attach to the preceding emote across spaces; intervening ordinary text breaks the chain. Consecutive modifiers accumulate a bitwise OR on the same base. Repeating an effect is idempotent: `ffzW ffzW` is not four times wide. A suffix modifier without a valid base is displayed as its own emote icon. `modifier_prefix` metadata supports the analogous sequence before a following emote.

In upstream FFZ, effects use a fixed source order, independent of token order. Appear+Leave becomes a single6second sequence. Slide suppressesSpin's rotation. FFZ emits multiple animations on the same element using normal CSS replacement composition; concurrent transform animations are not multiplied together. Priority among transform animations is Bounce above Jam above Shake above Spin above Appear/Leave. Rainbow can animate the filter while a transform animation runs. Static flips remain part of transform keyframes. Bounce+FlipY adds a100%vertical translation. The overlay intentionally changes the animation composition as described below.

FFZ caps modified dimensions at128×40pixels at1×scale; upstream rotation additionally limits image width to32pixels while keeping aspect ratio. The overlay preserves the general128×40cap with proportional display scaling, but removes the rotation-specific32px limit so Spin does not undo Wide.

## Standalone renderer API

`OverlayModifiers.builtIn` is a Map of the twelve token descriptors.

`resolve(token, providerEmote)` consumes FFZ metadata when available, otherwise falls back to the confirmed token names. It returns null or `{name, flags, id, modifier, prefix, hidden, unsupportedFlags}`. Unsupported bits are surfaced explicitly.

`apply(element, flags, {width, height, scale})` returns a new sized wrapper containing the provided composited visual element. Pass the union of all flags once. Width and height are rendered pixels; scale defaults to1. The content receives a100%width/height class. It must be an image or a visual container with its own layers arranged inside it. `installStyles(document)` is idempotent and is called automatically.

The slide implementation repeats DOM copies inside a clipped strip, rather than FFZ's single CSS background image. This permits the overlay's existing 7TV zero-width layers to scroll together. Effect frame values are preserved. In v0.2.0, separate nested stages compose Spin, Shake, Jam, Bounce, and arrival/departure, in that outer-to-inner order; Slide operates on the inner visual. Static flips and filters remain outside these stages. This intentionally differs from FFZ's single-element replacement composition and allows all requested motion effects to remain active. Applying transformations to the composited visual container is also a deliberate overlay design choice; FFZ's native web implementation targets its base image and separately places visible modifier overlays. Transition timing is fixed at three seconds singly or six seconds combined and is not synchronized to GIF frame duration.

## Future additions

Reading live FFZ metadata automatically discovers new token names and new combinations of supported flag bits. A novel effect bit or entirely new rendering algorithm needs an implementation update. An overlay cannot infer a new animation from an unfamiliar bit number alone. Unknown flag bits should retain visible fallback text/icon and be reported, rather than silently pretending full support.

The twelve named effects are official FFZ metadata, with creation dates in2023. Their presence in a new Moltorino release is new client support for an existing provider format; they are distinct from7TV's image-overlay zero-width mechanism.
