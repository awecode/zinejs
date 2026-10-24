#!/usr/bin/env bash
#
# Release a new version of the WordPress plugin (integrations/wordpress).
#
# Rebuilds the bundled engine and pdf.js assets, writes the plugin, engine and pdf.js versions
# into zinejs.php and readme.txt, commits, tags wp-X.Y.Z, and pushes, which triggers the
# wordpress.org deploy (.github/workflows/deploy-wordpress.yml).
#
# Run it after scripts/release.sh when the engine changed: the bundled engine must match a
# released v* tag. Write the "= X.Y.Z =" changelog entry in readme.txt first; it may be
# uncommitted, and is included in the release commit.
#
# Usage: scripts/release-wp.sh <version> [--yes]
#   <version>  new plugin semver, e.g. 1.1.2 (must be newer than current)
#   --yes|-y   skip the confirmation prompt
set -euo pipefail

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; }

VERSION=""
YES=""
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "error: unknown option '$arg'" >&2; usage; exit 1 ;;
    *) VERSION="$arg" ;;
  esac
done

[ -z "$VERSION" ] && { echo "error: version required" >&2; usage; exit 1; }

# Always operate from the repo root.
cd "$(git rev-parse --show-toplevel)"

WP=integrations/wordpress
PHP="$WP/zinejs.php"
README="$WP/readme.txt"

if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "error: '$VERSION' is not a valid version (expected X.Y.Z)" >&2
  exit 1
fi

# Current plugin version, from the plugin header.
CURRENT=$(sed -nE 's/^ \* Version: +([^ ]+).*/\1/p' "$PHP")
HIGHEST=$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -V | tail -1)
if [ "$VERSION" = "$CURRENT" ] || [ "$HIGHEST" != "$VERSION" ]; then
  echo "error: $VERSION is not newer than the current plugin version $CURRENT" >&2
  exit 1
fi

TAG="wp-$VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "error: tag $TAG already exists" >&2
  exit 1
fi

# Only the changelog may be pending; everything else in the release commit is generated here.
if [ -n "$(git status --porcelain | grep -v " $README\$" || true)" ]; then
  echo "error: working tree has changes other than $README; commit or stash them first" >&2
  exit 1
fi

if ! grep -qxF "= $VERSION =" "$README"; then
  echo "error: no '= $VERSION =' changelog entry in $README; write it first" >&2
  exit 1
fi

# The bundled engine must be a released one, so the version the plugin reports is what it ships.
ENGINE=$(node -p "require('./packages/core/package.json').version")
if ! git rev-parse -q --verify "refs/tags/v$ENGINE" >/dev/null; then
  echo "error: engine $ENGINE has no v$ENGINE tag; run scripts/release.sh first" >&2
  exit 1
fi
if ! git diff --quiet "v$ENGINE" HEAD -- packages/core/src packages/pdf/src; then
  echo "error: the engine changed since v$ENGINE; run scripts/release.sh first" >&2
  exit 1
fi
PDFJS=$(node -p "require('./node_modules/pdfjs-dist/package.json').version")

BRANCH=$(git branch --show-current)
OLD_ENGINE=$(sed -nE "s/^define\('ZINEJS_ENGINE_VERSION', '([^']+)'\);/\1/p" "$PHP")

if [ -z "$YES" ]; then
  echo "Release plugin $CURRENT -> $VERSION on '$BRANCH' (engine $OLD_ENGINE -> $ENGINE, pdf.js $PDFJS):"
  echo "  rebuild assets, bump versions, commit, tag $TAG, push origin $BRANCH and $TAG (triggers deploy)"
  printf "Proceed? [y/N] "
  read -r ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

"$WP/bin/update-assets.sh" >/dev/null

sed -i -E \
  -e "s/^( \* Version: +).*/\1$VERSION/" \
  -e "s/^define\('ZINEJS_VERSION', '[^']*'\);/define('ZINEJS_VERSION', '$VERSION');/" \
  -e "s/^define\('ZINEJS_ENGINE_VERSION', '[^']*'\);/define('ZINEJS_ENGINE_VERSION', '$ENGINE');/" \
  -e "s/^define\('ZINEJS_PDFJS_VERSION', '[^']*'\);/define('ZINEJS_PDFJS_VERSION', '$PDFJS');/" \
  "$PHP"
sed -i -E "s/^Stable tag: .*/Stable tag: $VERSION/" "$README"
echo "bumped plugin -> $VERSION (engine $ENGINE, pdf.js $PDFJS)"

git add "$WP"
git commit -m "chore(wp): release $VERSION (engine $ENGINE)"
git tag -a "$TAG" -m "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"

echo "pushed $TAG. Watch it deploy: Actions -> Deploy WordPress plugin."
