#!/bin/sh
# Compatibility entry point. The build itself runs in Node.js on every platform.
exec node "$(dirname "$0")/scripts/build.mjs" "$@"
