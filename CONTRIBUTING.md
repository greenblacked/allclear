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

Every pull request with a user-visible change adds a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md). To release:

```bash
git switch main && git pull --ff-only
./scripts/release/bump.sh minor        # or patch, major, or an exact 1.2.3
git push -u origin release/v0.2.0      # the script prints the exact branch
```

[`bump.sh`](scripts/release/bump.sh) refuses to run on anything but a clean, up-to-date `main`, and refuses when there is nothing under Unreleased or the tag already exists. It then:

- bumps `package.json` and `package-lock.json`;
- turns `## [Unreleased]` into `## [0.2.0] - <today>` with a new empty Unreleased above it;
- updates the compare links;
- commits `chore(release): 0.2.0` on `release/v0.2.0`, authored by you.

Open a pull request from that branch. When it merges, [`release.yml`](.github/workflows/release.yml) sees the new version on `main` and:

1. runs typecheck, tests and build;
2. tags the merge commit `v0.2.0`;
3. publishes a GitHub Release with the `## [0.2.0]` section as its notes.

If any check fails, nothing is tagged or published: fix it on `main` and use **Run workflow** on Release. A push that changes `package.json` without changing the version releases nothing.

Two other ways in, for the same checks:

- **Run workflow** on `main` releases the current `package.json` version if it has no tag yet. This is how `0.1.0`, which is already in `package.json`, gets published.
- Pushing a tag by hand (`git tag -a v0.2.0 -m "Status Bar 0.2.0" && git push origin v0.2.0`) publishes that tag, provided it matches `package.json` and is on `main`.

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
