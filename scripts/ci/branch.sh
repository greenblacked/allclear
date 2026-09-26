#!/usr/bin/env bash
# Check a branch name against CONTRIBUTING.md#branches:
# <prefix>/<short-kebab-description>, prefix one of fb, fix, chore, docs, ci.
# Run locally: ./scripts/ci/branch.sh "$(git branch --show-current)"
set -euo pipefail

name="${1:?usage: branch.sh <branch-name>}"
prefixes='fb|fix|chore|docs|ci'
max=50

# A pull request from dev into main is a release. main is never a head
# branch: resolving a conflict on a main-to-dev pull request commits dev's
# work to main and releases it (CONTRIBUTING.md#releases has the safe way).
if [[ "$name" == dev ]]; then
  echo "ok  branch  $name (long-lived)"
  exit 0
fi
# Branches that tools name for us: Dependabot updates and bump.sh releases.
if [[ "$name" =~ ^dependabot/ || "$name" =~ ^release/v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ok  branch  $name (named by tooling)"
  exit 0
fi

if [[ ! "$name" =~ ^($prefixes)/[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "::error::branch  $name: expected <prefix>/<short-kebab-description>, prefix one of ${prefixes//|/, }, lowercase letters, digits and single hyphens (CONTRIBUTING.md#branches)" >&2
  exit 1
fi
if (( ${#name} > max )); then
  echo "::error::branch  $name: ${#name} characters, keep it to $max (CONTRIBUTING.md#branches)" >&2
  exit 1
fi
echo "ok  branch  $name"
