# Contributing

Bug reports and focused pull requests are welcome. Include a concrete input message and expected overlay behavior when reporting a rendering issue.

## Local checks

Install Node.js 20 or newer, then run:

```sh
npm install
npx playwright install chromium
npm test
npm run test:browser
```

The runtime itself has no npm dependencies. Playwright is only used for browser verification. Live provider checks are intentionally separate from the deterministic suite because public API data changes.

Keep chat text as DOM text nodes, accept only HTTPS provider assets, and retain unknown modifier text rather than silently discarding it. Do not commit `research/snapshots`, `test-results`, logs, credentials, or captured chat content.

FFZ effect values are adapted under Apache-2.0; changes derived from upstream FFZ must preserve the attribution in `modifiers.js` and `LICENSE-FFZ.txt`.
