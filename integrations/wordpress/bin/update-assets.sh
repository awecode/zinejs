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

# The importable curls (roll/leaf/flick/silk) are a code-split ESM chunk that imports sibling
# chunks with hashed names (which change every build). Vendor curls.js as zine-curls.mjs and copy
# the exact chunks it imports, transitively, so the relative imports resolve at runtime.
find "$VENDOR" -name '*-*.js' ! -name '*.umd.js' -delete # drop stale curl chunks from a prior build
cp "$ROOT/packages/core/dist/curls.js" "$VENDOR/zine-curls.mjs"
node -e '
  const fs = require("fs"), path = require("path");
  const [dist, vendor] = [process.argv[1], process.argv[2]];
  const seen = new Set(), queue = [path.join(dist, "curls.js")];
  while (queue.length) {
    const code = fs.readFileSync(queue.pop(), "utf8");
    const re = /from\s*"(\.\/[^"]+)"/g; let m;
    while ((m = re.exec(code))) {
      const name = m[1].slice(2);
      if (seen.has(name)) continue;
      seen.add(name);
      fs.copyFileSync(path.join(dist, name), path.join(vendor, name));
      queue.push(path.join(dist, name));
    }
  }
' "$ROOT/packages/core/dist" "$VENDOR"

echo "Copied to $VENDOR:"
ls -1 "$VENDOR"
echo
echo "Now bump ZINEJS_ENGINE_VERSION ($(node -p "require('$ROOT/packages/core/package.json').version")) and ZINEJS_PDFJS_VERSION ($(node -p "require('$ROOT/node_modules/pdfjs-dist/package.json').version")) in zinejs.php if they changed."
