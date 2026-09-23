# Workflows

| Workflow | Trigger | What it guards |
| --- | --- | --- |
| [`ci.yml`](ci.yml) | push to `main`, every PR, manual | Typecheck, tests, build and SSR smoke on the Node version pinned in `.nvmrc` and on Node 24; repository hygiene, documentation links, shell scripts, commit messages, workflow syntax |
| [`codeql.yml`](codeql.yml) | push to `main`, PRs into `main`, weekly, manual | Static security and quality analysis of the TypeScript sources |
| [`dependency-review.yml`](dependency-review.yml) | PRs into `main` | Blocks high or critical vulnerabilities in dependency changes. Warns, and does not fail, when Dependency graph is off |
| [`ci-triage.yml`](ci-triage.yml) | completion of CI, CodeQL or Dependency review on a PR | One self-updating comment per PR naming the failed job, the failed step and its likely cause, plus a `ci-failed` label. Reads the API only and never runs PR code. Active once on `main` |
| [`source-health.yml`](source-health.yml) | hourly, manual | Calls the real vendor endpoints and keeps one `source-health` issue open per broken collector, closing it on recovery |
| [`screenshot.yml`](screenshot.yml) | manual, PRs that change it | Builds and runs the board where the vendors are reachable, captures it with live data, and uploads `board-screenshot` for the README's `docs/board.png` |

Every check in `ci.yml` has a local equivalent:

```bash
npm ci && npm run typecheck && npm test && npm run build
./scripts/ci/hygiene.sh  # line endings, trailing whitespace, final newline, no `any`, no raw hex
./scripts/ci/links.sh    # relative links in the Markdown docs
./scripts/ci/commits.sh origin/main..HEAD
node --experimental-strip-types scripts/ci/source-health.ts   # live vendor check, exits 1 on any failure
```
