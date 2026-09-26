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

## Branches

Name a branch `<type>/<summary>`:

- **`<type>`** is the Conventional Commit type the pull request's title will have. The branch, the title and the [release](#releases) it produces then all say the same thing.
- **`<summary>`** is two to five lowercase words joined by hyphens, saying what changes. Use only `a-z`, `0-9` and `-`, and keep the whole name under 50 characters.
- **An issue number** goes first in the summary when there is one: `fix/42-aws-stale-events`.

| Good | Not | Why |
| --- | --- | --- |
| `feat/board-metrics-stars-shortcuts` | `feature/Board_Metrics` | The type is spelled as in commits; lowercase with hyphens only |
| `fix/42-aws-stale-events` | `fix-aws` | A slash separates the type, which Git clients group by, and the summary says what is fixed |
| `docs/readme-integrations` | `username/readme` | Say what changes, not who changes it. The commit author already records who |
| `ci/release-every-merge` | `claude/release-ci`, `wip-2026-09-25` | Tool names and dates say nothing about the change |

Rules:

- Branch from an up-to-date `main`, and open one pull request per branch.
- Bring `main` in with a merge, not a rebase, once the branch is pushed. Others may have it checked out (see [docs/git-and-readme.md](docs/git-and-readme.md#authorship)).
- Keep the name when the work grows: a pull request cannot move to another branch, so renaming one means opening a new pull request.
- Delete the branch once it is merged.
- `main` takes changes only through pull requests, apart from the release commit CI pushes. `release/vX.Y.Z` branches come from [`scripts/release/bump.sh`](scripts/release/bump.sh), not by hand.

## Pull requests

- Keep the default branch green
- Describe the user-visible change in the PR body
- Link any issue
- Prefer small PRs that a reviewer can hold in their head

## Releases

Status Bar uses [Semantic Versioning](https://semver.org/), and every merged pull request with a feature or a fix is its own release, with a `vX.Y.Z` tag and a GitHub Release. Before 1.0, a minor version adds services, features or health rules, and a patch fixes behavior without changing them.

Every pull request with a user-visible change adds its lines under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md). Its title is a [Conventional Commit](#commits), because a squash merge makes the title the commit on `main`, and that commit's type picks the version:

| Commit type on `main` | Release |
| --- | --- |
| `!` after the type, or a `BREAKING CHANGE:` footer | major |
| `feat` | minor |
| `fix`, `perf`, `revert` | patch |
| `docs`, `ci`, `build`, `chore`, `refactor`, `test`, `style` | none |

When the merge lands, [`release.yml`](.github/workflows/release.yml):

1. Reads every commit since the last tag and takes the largest bump ([`scripts/release/next.sh`](scripts/release/next.sh)). No feature, fix or breaking change means no release.
2. Checks the release:
   - the new tag doesn't exist yet;
   - typecheck, tests and build pass.
3. Commits `chore(release): X.Y.Z` to `main`, authored by the account that merged. The commit updates `package.json`, `package-lock.json` and the changelog, and turns `## [Unreleased]` into the dated `## [X.Y.Z]` section. If the pull request added nothing under Unreleased, the section is written from the merged commits' subjects instead.
4. Tags that commit `vX.Y.Z`.
5. Publishes the GitHub Release with that section as its notes.

If a check fails, nothing is committed, tagged or published. When merges land close together, one run releases them together: GitHub keeps only the newest waiting run, and each run releases everything since the last tag. [`pr-title.yml`](.github/workflows/pr-title.yml) fails a pull request whose title is not a Conventional Commit, since such a merge would release nothing.

Other ways in, with the same checks:

| Way | When |
| --- | --- |
| **Run workflow** with bump `patch`, `minor` or `major` | A release by hand, for merged changes whose types release nothing, such as a `refactor` worth shipping. It needs lines under Unreleased. `gh workflow run release.yml --ref main -f bump=patch` |
| **Run workflow** with bump `current` | Publishes the `package.json` version as it is, if it has no tag yet. Use it to retry a run that committed the bump but did not publish. |
| [`scripts/release/bump.sh`](scripts/release/bump.sh) `minor` | Makes the same bump commit locally on `release/vX.Y.Z` for review in a pull request. Merging it releases that version as it is. |
| **Run workflow** with `version` and `commit` | Backfills an older release: tags that commit on `main` with a version whose section is already in `main`'s changelog, and publishes it without marking it Latest. `gh workflow run release.yml --ref main -f version=0.1.1 -f commit=4cf30fd` |
| A tag pushed by hand | `git tag -a v0.4.0 -m "Status Bar 0.4.0" && git push origin v0.4.0` publishes that tag, if it matches `package.json` and is on `main`. |

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
