#!/usr/bin/env bash
# Enforce the Conventional Commits rules from CONTRIBUTING.md on a commit range.
# Run locally: ./scripts/ci/commits.sh origin/main..HEAD
set -euo pipefail

range="${1:-origin/main..HEAD}"
types='feat|fix|docs|refactor|test|chore|perf|ci|build|style|revert'
fail=0

# `mapfile < <(...)` cannot see the subshell's exit status, so an unfetched or
# malformed range would look like "no commits" and pass the gate silently.
if ! git rev-list --no-merges "$range" >/dev/null 2>&1; then
  echo "::error::cannot resolve commit range: $range" >&2
  exit 1
fi

mapfile -t shas < <(git rev-list --no-merges "$range")

if [ "${#shas[@]}" -eq 0 ]; then
  echo "commits: no non-merge commits in $range"
  exit 0
fi

for sha in "${shas[@]}"; do
  subject="$(git log -1 --format=%s "$sha")"
  short="${sha:0:8}"
  bad=0

  if ! printf '%s' "$subject" | grep -qE "^($types)(\([a-z0-9._/-]+\))?!?: .+"; then
    echo "::error::$short  not a Conventional Commit: $subject" >&2
    echo "         expected <type>(<optional scope>): <imperative summary>, type one of: ${types//|/, }" >&2
    fail=1
    continue
  fi

  if [ "${#subject}" -gt 72 ]; then
    echo "::error::$short  subject is ${#subject} chars, limit is 72: $subject" >&2
    fail=1; bad=1
  fi

  if printf '%s' "$subject" | grep -qE '\.$'; then
    echo "::error::$short  subject ends with a period: $subject" >&2
    fail=1; bad=1
  fi

  # CONTRIBUTING.md: imperative mood ("add", not "added").
  if printf '%s' "$subject" | grep -qiE "^($types)(\([a-z0-9._/-]+\))?!?: (added|fixed|updated|removed|changed|created|bumped) "; then
    echo "::error::$short  use imperative mood (add, not added): $subject" >&2
    fail=1; bad=1
  fi

  [ "$bad" -eq 0 ] && echo "ok  $short  $subject"
done

if [ "$fail" -ne 0 ]; then
  echo "commits: FAILED" >&2
  exit 1
fi
echo "commits: OK"
