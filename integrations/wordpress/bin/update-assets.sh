#!/usr/bin/env bash
#
# Refresh the bundled engine + pdf.js assets from the monorepo. Run from the plugin directory.
# Builds @zinejs/core and @zinejs/pdf, then copies their UMD builds and the matching pdf.js
# (legacy build, for broad browser reach) into assets/vendor/.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"             # the plugin dir
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"   # the monorepo root (location-independent)
VENDOR="$HERE/assets/vendor"

echo "Building @zinejs/core and @zinejs/pdf..."
(cd "$ROOT" && pnpm --filter @zinejs/core build && pnpm --filter @zinejs/pdf build)

cp "$ROOT/packages/core/dist/index.umd.js" "$VENDOR/zine-core.umd.js"
cp "$ROOT/packages/pdf/dist/index.umd.js" "$VENDOR/zine-pdf.umd.js"
cp "$ROOT/node_modules/pdfjs-dist/legacy/build/pdf.min.mjs" "$VENDOR/pdf.min.mjs"
cp "$ROOT/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs" "$VENDOR/pdf.worker.min.mjs"

echo "Copied to $VENDOR:"
ls -1 "$VENDOR"
echo
echo "Now bump ZINEJS_ENGINE_VERSION ($(node -p "require('$ROOT/packages/core/package.json').version")) and ZINEJS_PDFJS_VERSION ($(node -p "require('$ROOT/node_modules/pdfjs-dist/package.json').version")) in zinejs.php if they changed."
