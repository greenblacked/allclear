#!/usr/bin/env bash
# Print one version's CHANGELOG.md section, without its heading, as release
# notes. Fails when the section is missing or empty, so a tag cannot publish
# a release with no notes.
# Run locally:
#   ./scripts/ci/release-notes.sh 0.1.0
#   ./scripts/ci/release-notes.sh          # the version in package.json
# CHANGELOG=path reads another copy of the changelog, such as main's while an
# older commit is checked out.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
changelog="${CHANGELOG:-CHANGELOG.md}"

version="${1:-$(node -p "require('./package.json').version")}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::'$version' is not a MAJOR.MINOR.PATCH version" >&2
  exit 1
fi

# From "## [<version>]" up to the next "## [" heading. Link reference
# definitions are left out: after the last section they belong to the file.
notes="$(awk -v heading="## [$version]" '
  index($0, heading) == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found && /^\[[^]]+\]: / { next }
  found { print }
' "$changelog" | sed -e '/./,$!d')"

if [ -z "${notes//[[:space:]]/}" ]; then
  echo "::error file=$changelog::no '## [$version]' section with content" >&2
  exit 1
fi

printf '%s\n' "$notes"
