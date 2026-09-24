# Contributing to Status Bar

Two documents govern how work lands in this repository:

1. This file — what to change, how to send it, and how authorship works
2. [docs/git-and-readme.md](docs/git-and-readme.md) — commit messages and README structure

Please read both before opening a pull request.

## Authorship

Commits must be attributed to a **real GitHub account**, never to a generic bot identity.

- Configure `user.name` and `user.email` to match the GitHub account that owns the commit
- Do not rewrite history to hide a human author or to invent one
- Add `Co-authored-by: Name <email>` only for people who actually wrote the change
- Do not add `Co-authored-by` for an AI tool unless the project later adopts that convention in writing

The GitHub account that pushes is the author of record.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(cs2): surface Europe datagram pops with relay counts
fix(aws): ignore Health events older than 14 days
docs: add official source table to README
```

Rules:

- Imperative mood (“add”, not “added”)
- Subject ≤ 72 characters, no trailing period
- One logical change per commit
- Body explains *why* when the diff is not obvious
- Never commit secrets, `.env` files, or vendor credentials (Status Bar does not need any)

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

## Pull requests

- Keep the default branch green
- Describe the user-visible change in the PR body
- Link any issue
- Prefer small PRs that a reviewer can hold in their head

## Releases

Status Bar uses [Semantic Versioning](https://semver.org/). Before 1.0, a minor version adds services or changes health rules, and a patch fixes behavior without changing the rules.

Every pull request with a user-visible change adds a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md). Releases are cut from CI:

1. Open **Actions → Release → Run workflow** on `main`, or run the command below.
2. Pick `patch`, `minor` or `major` for **bump**.

```bash
gh workflow run release.yml --ref main -f bump=minor
```

[`release.yml`](.github/workflows/release.yml) then:

1. Checks the release:
   - there is something under Unreleased;
   - the new tag doesn't exist yet;
   - typecheck, tests and build pass.
2. Commits `chore(release): X.Y.Z` to `main`, authored by the account that ran the workflow. The commit updates `package.json`, `package-lock.json` and the changelog, and dates the new changelog section.
3. Tags that commit `vX.Y.Z`.
4. Publishes the GitHub Release with the new changelog section as its notes.

If a check fails, or `main` moves while the run is in progress, nothing is committed, tagged or published.

Other ways in, with the same checks:

| Way | When |
| --- | --- |
| **Run workflow** with bump `current` | Publishes the `package.json` version as it is, if it has no tag yet. Use it for the first release (`0.1.0`), or to retry a run that committed the bump but did not publish. |
| [`scripts/release/bump.sh`](scripts/release/bump.sh) `minor` | Makes the same bump commit locally on `release/vX.Y.Z` for review in a pull request. Merging it tags the merge commit and publishes. |
| A tag pushed by hand | `git tag -a v0.2.0 -m "Status Bar 0.2.0" && git push origin v0.2.0` publishes that tag, if it matches `package.json` and is on `main`. |

A push to `main` that changes `package.json` without changing the version releases nothing.

The bump commit and the tag are pushed with the workflow's `GITHUB_TOKEN`, so they start no other workflow and CI does not run on the bump commit itself. The verify job has already checked the same code.

If `main` later gets a ruleset that requires pull requests or status checks, the workflow's direct push to `main` is rejected unless GitHub Actions is a bypass actor. Until that is set up, release with `bump.sh` and a pull request.

Never move or reuse a tag that has a published release; release a new patch version instead.

## Dependencies

Dependabot proposes npm and GitHub Actions updates weekly, grouped into production dependencies, development dependencies and Actions.

- Actions stay pinned to a full commit SHA with the version in a trailing comment
- `@types/node` must match the oldest supported Node (`engines` and `.nvmrc`), so Dependabot skips its major versions. Raise it by hand in the same PR that raises `engines`

## Adding a service

1. Add a catalog entry in `src/lib/status/catalog.ts`
2. Add a collector in `src/lib/status/sources.server.ts`
3. Use an **official** machine-readable source (Statuspage JSON, vendor incident JSON, RSS, or a documented public API)
4. Document the source in the README table
5. Map vendor states onto `operational | degraded | outage | maintenance | unknown`

Do not scrape unofficial aggregators.

## Code style

- TypeScript strict, no `any`
- Tokens live in `src/styles.css`; do not sprinkle raw hex in JSX
- Status color is for badges only, not entire panels
- Keep fetch timeouts short and failures isolated (`Promise.all` of per-service collectors)
