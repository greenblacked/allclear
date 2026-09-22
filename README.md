# AllClear

[![CI](https://github.com/greenblacked/status-page/actions/workflows/ci.yml/badge.svg)](https://github.com/greenblacked/status-page/actions/workflows/ci.yml)
[![CodeQL](https://github.com/greenblacked/status-page/actions/workflows/codeql.yml/badge.svg)](https://github.com/greenblacked/status-page/actions/workflows/codeql.yml)

**Repository:** [github.com/greenblacked/status-page](https://github.com/greenblacked/status-page)

Centralized live status board for the services people actually wait on: **GCP**, **AWS**, **Steam** (including **CS2 Europe**), **Epic Games** (including **Fortnite**), **Spotify**, **Apple**, **Android / Google Play**, **Grok**, **ChatGPT**, **Claude**, plus official **MikroTik RouterOS** and **Apple OS** changelogs.

AllClear reads **official vendor status surfaces only**. No rumor, no Downdetector, no API keys.

## Why this exists

Status is scattered across a dozen dashboards with different shapes. AllClear normalizes them into one board:

| Health | Meaning |
| --- | --- |
| Operational | Vendor reports no active incident |
| Degraded | Partial impact, elevated errors, or thin coverage |
| Outage | Major / critical impact |
| Maintenance | Scheduled work in progress |
| Unknown | Official source timed out or returned an error |

## Data sources

| Service | Official source | How it is read |
| --- | --- | --- |
| Google Cloud | [status.cloud.google.com](https://status.cloud.google.com/) | `incidents.json`, open items only |
| AWS | [AWS Health](https://health.aws.amazon.com/health/status) | Public current events (UTF-16 JSON). Regional items count as degraded, not a global outage. Events with no update in 14 days are ignored. |
| Steam | [Steam Web API](https://api.steampowered.com/) + Store | `GetServerInfo` + store featured API |
| CS2 Europe | Valve SDR config, app `730` | Europe datagram pops + live player count |
| Epic Games | [status.epicgames.com](https://status.epicgames.com/) | Statuspage summary, Fortnite components excluded |
| Fortnite | same Epic page | Components whose name includes “Fortnite” |
| Spotify | [spotify.statuspage.io](https://spotify.statuspage.io/) | Statuspage summary |
| Apple | [System Status](https://www.apple.com/support/systemstatus/) | `system_status_en_US.js` |
| Android / Play | [Play Status](https://status.play.google.com/summary) | Play `incidents.json` |
| Grok | [status.x.ai](https://status.x.ai/) | RSS `feed.xml` (JSON API is Cloudflare-gated) |
| ChatGPT | [status.openai.com](https://status.openai.com/) | Statuspage summary |
| Claude | [status.claude.com](https://status.claude.com/) | Statuspage summary |
| MikroTik RouterOS | [MikroTik changelogs](https://mikrotik.com/download/changelogs) | Official `NEWEST*` channel files + `CHANGELOG` |
| Apple OS | [Apple Developer Releases](https://developer.apple.com/news/releases/) | Official releases RSS for iOS, iPadOS, macOS, watchOS, tvOS, visionOS |

Snapshots cache for 45 seconds on the server. Opening the board always pulls a fresh check. After that, official sources are re-checked every two minutes and a board update is posted on the 2-minute clock.

## Using the board

- Scan the overall card: **All clear**, **Attention**, or **Outage**
- Watch the **2-minute countdown** and the board log for posted updates
- Filter by Cloud / Gaming / Platforms / AI / Updates
- Toggle **Issues only**
- Refresh immediately if you need a fresh pull from vendors
- Open the vendor’s own status page from any card

AllClear is an aggregator. Vendor pages remain the source of truth.

## Project layout

```text
src/lib/status/           # catalog, health model, official fetchers
src/components/status/    # board UI
src/routes/               # TanStack Start routes
docs/                     # commit and README conventions
scripts/ci/               # checks that CI and contributors run identically
.github/workflows/        # CI and CodeQL
```

## Development

The UI is React 19 on TanStack Start with Tailwind v4. Status collection happens in a server function (`src/lib/status/board.ts`) so the browser never has to fight CORS.

**Requires Node 22.18+ or 24+.** The test suite imports `.ts` modules directly and relies on native type stripping, so it needs no install step and no test framework.

### Checks

Every CI check has the same local command:

```bash
node --test                               # whole suite
node --test src/lib/status/diff.test.ts   # a single file

./scripts/ci/hygiene.sh                   # line endings, trailing whitespace, final newline, no `any`, no raw hex in JSX
./scripts/ci/links.sh                     # relative links in the Markdown docs
./scripts/ci/commits.sh origin/main..HEAD # Conventional Commits
```

Covered by tests: board diffing, the two-minute pulse, changelog parsing, and the pure decision rules inside the vendor collectors (Grok feed staleness, AWS event activity). The collectors' network paths are not covered, and neither is `http.ts`.

### Toolchain status

A fresh clone cannot build or serve the board yet, and CI is scoped to what is reproducible today. Two things are missing:

- No `package.json`, lockfile, or bundler config is committed, so there is no `npm install` and no dev server
- `src/router.tsx` and `src/routes/__root.tsx` import three modules that are not in the tree: `@/lib/error-component`, `@/lib/auth/provider`, and `@/components/preview-host-bridge`

Once both land, add an `npm` entry to [`.github/dependabot.yml`](.github/dependabot.yml) and typecheck, lint, and build jobs to [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Git and authorship

Commits in this repo follow Conventional Commits and are authored as the GitHub user who pushes them. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/git-and-readme.md](docs/git-and-readme.md).

## Disclaimer

Not affiliated with Google, Amazon, Valve, Epic Games, Spotify, Apple, MikroTik, xAI, OpenAI, or Anthropic. Names and marks belong to their owners.

## License

MIT. See [LICENSE](LICENSE).
