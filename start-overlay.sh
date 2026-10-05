#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 18 or newer is needed only for the optional local URL server.'
  printf '%s\n' 'The HTML files in dist work directly as a browser local file without Node.js.'
  exit 1
fi
exec node server.mjs
