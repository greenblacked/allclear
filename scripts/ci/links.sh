#!/usr/bin/env bash
# Verify that every relative link and image in the Markdown docs resolves.
# README badges must map to a real check (docs/git-and-readme.md), so a badge
# that points at a workflow file also has to point at a workflow that exists.
# Run locally: ./scripts/ci/links.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
fail=0

while IFS= read -r doc; do
  dir="$(dirname "$doc")"
  while IFS= read -r target; do
    # Strip an optional #anchor and any title after the URL.
    path="${target%%#*}"
    path="${path%% *}"
    [ -n "$path" ] || continue
    case "$path" in
      http://*|https://*|mailto:*|/*) continue ;;
    esac
    if [ ! -e "$dir/$path" ]; then
      echo "::error file=$doc::broken relative link: $target" >&2
      fail=1
    fi
  done < <(grep -oE '\]\([^)]+\)' "$doc" | sed -E 's/^\]\(//; s/\)$//')
done < <(git ls-files '*.md')

if [ "$fail" -ne 0 ]; then
  echo "links: FAILED" >&2
  exit 1
fi
echo "links: OK"
