# Changelog

All notable changes to Status Bar are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release's section becomes its GitHub Release notes, so write entries for someone reading the board, not the diff. [CONTRIBUTING.md](CONTRIBUTING.md#releases) describes how to cut a release.

## [Unreleased]

### Added

- A public JSON API at `/api/status.json`, with the board's overall health, headline and every service's status and incidents.
- An Atom feed at `/feed.xml` with one entry per service that needs attention. Subscribe Slack, Microsoft Teams, Discord or a feed reader to it for alerts without code.
- Shields.io status badges at `/api/badge/<service>`, and `/api/badge/board` for the whole board.

### Changed

- The board opens with one line naming the worst problem, such as "Outage: Apple", with links to every service that needs attention.
- Services that need attention come first, worst first. Operational services are compact one-line tiles, and the release trackers have their own section.
- The filters show how many services each one matches, and the browser tab shows how many need attention.

### Fixed

- An incident's text no longer appears up to three times on one card, and a long component detail no longer pushes its status badge out of the card.
- A card with an incident links to that incident instead of the vendor's front page.
- A Statuspage service in maintenance names the maintenance on its card instead of showing a blank summary.
- Google Cloud and Google Play incident links point to the incident, not to a malformed address.

## [0.1.0] - 2026-09-24

First tagged release.

### Added

- One board for fourteen services, each read from one official vendor source:
  - Cloud: Google Cloud and AWS
  - Gaming: Steam, CS2 Europe, Epic Games and Fortnite
  - Platforms: Spotify, Apple and Android / Google Play
  - AI: Grok, ChatGPT and Claude
  - Updates: MikroTik RouterOS and Apple OS releases
- Five health states: Operational, Maintenance, Degraded, Outage and Unknown. A source that times out or changes its format shows Unknown with the reason. It is never counted as operational.
- Summary cards across the top of the board: how many services are operational, what needs attention, and how many sources could be read.
- Server-side snapshots refresh every two minutes. A page load right after the snapshot expires gets the last snapshot while a fresh one loads. The Refresh button cannot trigger more than one vendor sweep every 15 seconds.
- Each failed collector writes one `collector_failed` JSON log line with the service, the failure kind (http, timeout, network or parser) and the latency.
- Docker Compose services that run the checks in the shared [github-base-images](https://github.com/greenblacked/github-base-images) CI images, with no local Node needed.
- CI:
  - typecheck, tests, build and a server-render smoke test on the pinned Node 22 and on Node 24;
  - CodeQL and dependency review;
  - one triage comment per pull request that explains failed checks;
  - an hourly job that checks the live vendor endpoints and opens one issue for each broken source.

[Unreleased]: https://github.com/greenblacked/status-page/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/greenblacked/status-page/releases/tag/v0.1.0
