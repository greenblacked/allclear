# AllClear

[![CI](https://github.com/greenblacked/status-page/actions/workflows/ci.yml/badge.svg)](https://github.com/greenblacked/status-page/actions/workflows/ci.yml)
[![CodeQL](https://github.com/greenblacked/status-page/actions/workflows/codeql.yml/badge.svg)](https://github.com/greenblacked/status-page/actions/workflows/codeql.yml)

One live board for the services people actually wait on, read only from each vendor's own status surface.

## Why

When something breaks, the answer is spread across a dozen vendor dashboards, each with its own layout and vocabulary. Third-party outage trackers are faster to check but report user complaints, not vendor-confirmed status.

AllClear reads the official sources, maps them onto one health model, and shows them side by side. It needs no API keys and uses no unofficial aggregators.

## What you get

Fourteen services in five groups:

| Group | Services |
| --- | --- |
| Cloud | Google Cloud, AWS |
| Gaming | Steam, CS2 Europe, Epic Games, Fortnite |
| Platforms | Spotify, Apple, Android / Google Play |
| AI | Grok, ChatGPT, Claude |
| Updates | MikroTik RouterOS, Apple OS releases |

Every service gets one of five states:

| State | Meaning |
| --- | --- |
| Operational | The vendor reports no active incident |
| Maintenance | Scheduled work is in progress |
| Degraded | Partial impact, elevated errors, or thin coverage |
| Outage | Major or critical impact |
| Unknown | The official source timed out, returned an error, or sent data AllClear could not read |

The overall card shows the worst state on the board: **All clear** when everything is Operational, **Outage** if any service is out, and **Attention** for anything in between.

## Sources

The source list is the contract: if a row is not here, AllClear does not read it.

| Service | Official source | How it is read |
| --- | --- | --- |
| Google Cloud | [status.cloud.google.com](https://status.cloud.google.com/) | `incidents.json`; only incidents without an end time count |
| AWS | [AWS Health](https://health.aws.amazon.com/health/status) | Public current events. An event counts while it is unresolved and updated within the last 14 days. Single-region or single-zone events are Degraded, not Outage |
| Steam | [Steam Web API](https://api.steampowered.com/) and Store | `GetServerInfo` plus the Store featured API. Both answering is Operational, one is Degraded, neither is Outage |
| CS2 Europe | Valve SDR config, app `730` | European relay points of presence plus the live player count. Degraded when fewer than 3, or fewer than 40%, of European pops publish relays |
| Epic Games | [status.epicgames.com](https://status.epicgames.com/) | Statuspage summary, worst component, excluding Fortnite components |
| Fortnite | [status.epicgames.com](https://status.epicgames.com/) | Same page, only components whose name contains "Fortnite" |
| Spotify | [spotify.statuspage.io](https://spotify.statuspage.io/) | Statuspage summary indicator |
| Apple | [System Status](https://www.apple.com/support/systemstatus/) | `system_status_en_US.js`, services with an active event |
| Android / Play | [Play Status](https://status.play.google.com/summary) | Play `incidents.json`; only incidents without an end time count |
| Grok | [status.x.ai](https://status.x.ai/) | RSS `feed.xml`, because the JSON API sits behind Cloudflare. An item counts when it is not resolved and was published within the last 14 days |
| ChatGPT | [status.openai.com](https://status.openai.com/) | Statuspage summary indicator |
| Claude | [status.claude.com](https://status.claude.com/) | Statuspage summary indicator |
| MikroTik RouterOS | [MikroTik changelogs](https://mikrotik.com/download/changelogs) | The official `NEWEST*` files for RouterOS 7 stable, long-term, testing and development and RouterOS 6 long-term, plus the newest version's `CHANGELOG` |
| Apple OS | [Apple Developer Releases](https://developer.apple.com/news/releases/) | Releases RSS, latest version of iOS, iPadOS, macOS, watchOS, tvOS and visionOS |

The two Updates services track releases, not incidents. They stay Operational, and a channel or OS released in the last 14 days is highlighted on its card.

Each source gets 9 seconds. A source that fails or changes its format shows as Unknown instead of a guess, and the card says why.

## Using the board

- Scan the overall card, then the Operational and Attention counts next to it. Attention counts every service that is not Operational
- Filter by Cloud, Gaming, Platforms, AI or Updates, search by name, or switch on **Issues only**
- The board pulls a new snapshot every two minutes. The countdown and the **Board log** run on two-minute slots of the clock
- Read the Board log for what changed between slots. It lives in your browser and keeps the last two hours
- Press Refresh to pull fresh data from every vendor now instead of waiting
- Open the vendor's own status page from any card

The server caches each snapshot for 45 seconds, so many open boards share one set of vendor requests.

AllClear is an aggregator. The vendor's page is always the source of truth.

## Development

React 19 on TanStack Start, styled with Tailwind v4. Collection runs in a server function (`src/lib/status/board.ts`), so the browser never has to deal with vendor CORS.

Use Node 22.13.0 and npm 11.9.0; `.nvmrc` and `packageManager` are authoritative.

```bash
npm ci
npm run dev        # local dev server
npm run typecheck
npm test
npm run build
```

`npm run preview` smoke-tests the built output; it is not a production host. The build exports a Fetch-style handler in `dist/server/server.js`, and this repository deliberately has no deployment adapter yet. Production needs an explicit SSR host before it can run.

### Project layout

```text
src/lib/status/           # catalog, health model, collectors, cache and schedule
src/components/status/    # board UI
src/routes/               # TanStack Start routes
scripts/ci/               # checks that CI and contributors run the same way
.github/workflows/        # CI, security scans, and the triage and source-health bots
docs/                     # commit and README conventions
```

### Adding a service

Add a catalog entry in `src/lib/status/catalog.ts` and a collector in `src/lib/status/sources.server.ts`. Read only an official machine-readable source, map it onto the five states, and add its row to the Sources table in the same commit. [CONTRIBUTING.md](CONTRIBUTING.md) has the full checklist.

### Checks

These need no install, and CI runs the same commands:

```bash
./scripts/ci/hygiene.sh                   # line endings, whitespace, final newline, no `any`, no raw hex in JSX
./scripts/ci/links.sh                     # relative links in the Markdown docs
./scripts/ci/commits.sh origin/main..HEAD # Conventional Commits
```

The tests cover board diffing, the two-minute schedule, changelog parsing, the server cache, the collectors' decision rules (AWS event activity, Grok feed staleness, failure classification), and both bots against fake GitHub APIs. PR CI stays offline, so it never calls a vendor.

### Automation

- **CI** type-checks, tests and builds on the pinned Node and on Node 24, smoke-tests the built app, and lints the repository, commits and workflows
- **CodeQL** scans the code on every PR, on `main`, and weekly
- **Dependency review** blocks PRs that add high or critical vulnerabilities. It needs the repository's Dependency graph setting; with that off, it passes with a warning that nothing was reviewed
- **CI triage** keeps one comment on a failing PR that names the failed job, step and likely cause, and removes its `ci-failed` label when the PR recovers
- **Source health** calls the real vendor endpoints every hour. It opens one issue per collector that can no longer read its source and closes it on recovery

To run the live source check locally:

```bash
node --experimental-strip-types scripts/ci/source-health.ts
```

Dependabot proposes npm and Actions updates weekly. It skips major versions of `@types/node`, which must match the oldest supported Node; raise it together with `engines`. [.github/workflows/README.md](.github/workflows/README.md) describes each workflow.

Report security issues through [SECURITY.md](SECURITY.md), not a public issue.

## Disclaimer

Not affiliated with Google, Amazon, Valve, Epic Games, Spotify, Apple, MikroTik, xAI, OpenAI, or Anthropic. Names and marks belong to their owners.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Commits follow Conventional Commits and are authored by the GitHub account that pushes them. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/git-and-readme.md](docs/git-and-readme.md) before opening a pull request.
