# Workflows

| Workflow | Trigger | What it guards |
| --- | --- | --- |
| [`ci.yml`](ci.yml) | push to `main`, every PR, manual | Typecheck, tests, build and SSR smoke on the Node version pinned in `.nvmrc` and on Node 24; repository hygiene, documentation links, shell scripts, commit messages, workflow syntax |
| [`codeql.yml`](codeql.yml) | push to `main`, PRs into `main`, weekly, manual | Static security and quality analysis of the TypeScript sources |

Every check in `ci.yml` has a local equivalent:

```bash
npm ci && npm run typecheck && npm test && npm run build
./scripts/ci/hygiene.sh  # line endings, trailing whitespace, final newline, no `any`, no raw hex
./scripts/ci/links.sh    # relative links in the Markdown docs
./scripts/ci/commits.sh origin/main..HEAD
```
