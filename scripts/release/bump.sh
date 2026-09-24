#!/usr/bin/env bash
# Prepare a release: bump the version, date the changelog and commit.
#
#   ./scripts/release/bump.sh patch|minor|major|X.Y.Z
#     Locally: commits on a new release/vX.Y.Z branch. Merging its pull
#     request makes release.yml tag the merge commit and publish.
#   ./scripts/release/bump.sh --ci patch|minor|major|X.Y.Z
#     In release.yml (Run workflow): commits on the checked-out main, which
#     the workflow then pushes, tags and publishes.
#
# The commit is authored by whoever runs it, locally or by clicking Run
# workflow, never by a bot identity (CONTRIBUTING.md#authorship).
set -euo pipefail

die() { echo "bump: $*" >&2; exit 1; }

ci=false
if [ "${1:-}" = --ci ]; then
  ci=true
  shift
fi
[ $# -eq 1 ] || die "usage: $0 [--ci] patch|minor|major|X.Y.Z"
cd "$(git rev-parse --show-toplevel)"

[ -z "$(git status --porcelain)" ] || die "working tree is not clean"
if [ "$ci" = true ]; then
  # actions/checkout already fetched main; a mismatch means main moved
  # after the run started.
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
    die "main moved after this run started; run it again"
else
  git fetch --quiet origin main
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
    die "release from an up-to-date main: git switch main && git pull --ff-only"
fi

current="$(node -p "require('./package.json').version")"
IFS=. read -r major minor patch <<<"$current"
case "$1" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  *)
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "'$1' is not patch, minor, major or X.Y.Z"
    next="$1"
    ;;
esac
if [ "$next" = "$current" ] || [ "$(printf '%s\n%s\n' "$current" "$next" | sort -V | tail -n1)" != "$next" ]; then
  die "$next is not newer than $current"
fi

tag="v$next"
branch="release/$tag"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
  die "$tag already exists"
fi
if [ "$ci" = false ] && git rev-parse -q --verify "refs/heads/$branch" >/dev/null; then
  die "branch $branch already exists"
fi

# Something has to be released: Unreleased needs at least one line of content.
unreleased="$(awk '
  /^## \[Unreleased\]/ { found = 1; next }
  found && /^## \[/ { exit }
  found && NF { print }
' CHANGELOG.md)"
[ -n "$unreleased" ] || die "CHANGELOG.md has nothing under ## [Unreleased]"

# The repository URL comes from the existing Unreleased compare link.
repo_url="$(sed -nE 's#^\[Unreleased\]: (.*)/compare/.*$#\1#p' CHANGELOG.md)"
[ -n "$repo_url" ] || die "CHANGELOG.md has no [Unreleased] compare link"

today="$(date -u +%F)"
changelog="$(mktemp)"
trap 'rm -f "$changelog"' EXIT
awk -v next_version="$next" -v current="$current" -v today="$today" -v url="$repo_url" '
  /^## \[Unreleased\]/ {
    print
    print ""
    print "## [" next_version "] - " today
    next
  }
  /^\[Unreleased\]: / {
    print "[Unreleased]: " url "/compare/v" next_version "...HEAD"
    print "[" next_version "]: " url "/compare/v" current "...v" next_version
    next
  }
  { print }
' CHANGELOG.md >"$changelog"
cat "$changelog" >CHANGELOG.md

npm version "$next" --no-git-tag-version --ignore-scripts >/dev/null
./scripts/ci/release-notes.sh "$next" >/dev/null

if [ "$ci" = true ]; then
  git commit --quiet -m "chore(release): $next" -- package.json package-lock.json CHANGELOG.md
  echo "Prepared $tag ($current -> $next) on $(git rev-parse --short HEAD)."
  exit 0
fi

git switch --quiet -c "$branch"
git commit --quiet -m "chore(release): $next" -- package.json package-lock.json CHANGELOG.md

cat <<EOF
Prepared $tag on branch $branch ($current -> $next).

Next:
  git push -u origin $branch
  then open a pull request into main. When it merges, release.yml tags
  the merge commit $tag and publishes the GitHub Release.
EOF
