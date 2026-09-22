# AllClear

**Repository:** [github.com/greenblacked/allclear](https://github.com/greenblacked/allclear)

Centralized live status board for the services people actually wait on: **GCP**, **AWS**, **Steam** (including **CS2 Europe**), **Epic Games** (including **Fortnite**), **Spotify**, **Apple**, **Android / Google Play**, **Grok**, **ChatGPT**, and **Claude**.

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

Snapshots cache for 45 seconds on the server and auto-refresh every minute in the UI.

## Using the board

- Scan the overall card: **All clear**, **Attention**, or **Outage**
- Filter by Cloud / Gaming / Platforms / AI
- Toggle **Issues only**
- Open the vendor’s own status page from any card

AllClear is an aggregator. Vendor pages remain the source of truth.

## Project layout

```text
src/lib/status/           # catalog, health model, official fetchers
src/components/status/    # board UI
src/routes/               # TanStack Start routes
docs/                     # commit and README conventions
```

## Development

This app runs on TanStack Start, React 19, and Tailwind v4. Status collection happens in a server function (`src/lib/status/board.ts`) so the browser never has to fight CORS.

## Git and authorship

Commits in this repo follow Conventional Commits and are authored as the GitHub user who pushes them. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/git-and-readme.md](docs/git-and-readme.md).

## Disclaimer

Not affiliated with Google, Amazon, Valve, Epic Games, Spotify, Apple, xAI, OpenAI, or Anthropic. Names and marks belong to their owners.

## License

MIT. See [LICENSE](LICENSE).
