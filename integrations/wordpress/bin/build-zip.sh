#!/usr/bin/env bash
#
# Build the WordPress.org distribution zip: a clean `zinejs/` folder with only the shipped files
# (dev tooling, wp-env config, and the .wordpress-org listing assets are excluded). The result,
# dist/zinejs.zip, is what you upload for the initial WordPress.org submission.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)" # the plugin dir
SLUG="zinejs"
OUT="$HERE/dist"
STAGE="$OUT/$SLUG"

rm -rf "$STAGE" "$OUT/$SLUG.zip"
mkdir -p "$STAGE"

# Copy the shipped files (keep this exclude list in sync with .distignore).
rsync -a \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.wp-env.json' \
  --exclude '.distignore' \
  --exclude 'README.md' \
  --exclude 'bin' \
  --exclude 'dist' \
  --exclude '.wordpress-org' \
  --exclude 'node_modules' \
  "$HERE/" "$STAGE/"

(cd "$OUT" && zip -rq "$SLUG.zip" "$SLUG")
rm -rf "$STAGE"

echo "Built $OUT/$SLUG.zip"
echo "Contents:"
unzip -l "$OUT/$SLUG.zip" | awk 'NR>3 && $4 {print "  "$4}' | grep -v '/$' | head -60
