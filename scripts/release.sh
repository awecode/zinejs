#!/usr/bin/env bash
#
# Release a new version of @zinejs/core and @zinejs/pdf.
#
# Validates the version is newer than the current one, bumps both package.json files,
# commits, tags vX.Y.Z, and pushes, which triggers the provenance publish workflow
# (.github/workflows/release.yml). Trusted publishing must be configured on npm for
# BOTH packages (repo + release.yml + environment) or the publish step will 404.
#
# Usage: scripts/release.sh <version> [--yes]
#   <version>  new semver, e.g. 0.9.2 or 1.0.0 (must be newer than current)
#   --yes|-y   skip the confirmation prompt
set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }

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

# Validate semver shape (X.Y.Z, optional -prerelease).
if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'; then
  echo "error: '$VERSION' is not a valid semver (expected X.Y.Z)" >&2
  exit 1
fi

PKGS=(packages/core packages/pdf)

# Current version = the highest of the two packages (they are normally in sync).
CORE_V=$(node -p "require('./packages/core/package.json').version")
PDF_V=$(node -p "require('./packages/pdf/package.json').version")
[ "$CORE_V" != "$PDF_V" ] && echo "warning: core ($CORE_V) and pdf ($PDF_V) versions differ" >&2
CURRENT=$(printf '%s\n%s\n' "$CORE_V" "$PDF_V" | sort -V | tail -1)

# Require the new version to be strictly newer than current.
HIGHEST=$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -V | tail -1)
if [ "$VERSION" = "$CURRENT" ] || [ "$HIGHEST" != "$VERSION" ]; then
  echo "error: $VERSION is not newer than the current version $CURRENT" >&2
  exit 1
fi

TAG="v$VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "error: tag $TAG already exists" >&2
  exit 1
fi

# The release commit must contain only the version bump.
if ! git diff-index --quiet HEAD --; then
  echo "error: working tree is not clean; commit or stash changes first" >&2
  exit 1
fi

BRANCH=$(git branch --show-current)

if [ -z "$YES" ]; then
  echo "Release $CURRENT -> $VERSION on '$BRANCH':"
  echo "  bump core + pdf, commit, tag $TAG, push origin $BRANCH and $TAG (triggers publish)"
  printf "Proceed? [y/N] "
  read -r ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

for p in "${PKGS[@]}"; do
  ( cd "$p" && npm version "$VERSION" --no-git-tag-version >/dev/null )
  echo "bumped $p -> $VERSION"
done

git commit -am "chore(release): v$VERSION"
git tag -a "$TAG" -m "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"

echo "pushed $TAG. Watch it publish: Actions -> Release."
