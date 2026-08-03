# Plugins

What to install, from where, and how each is configured. Verdicts reflect
research as of 2026-08. "Modern SDK" = Elgato's official Node.js SDK v2
(`@elgato/streamdeck`, manifest `SDKVersion: 3`, Stream Deck app 6.9+).

## Install checklist

| # | Plugin | Use | Source | SDK | Notes |
|---|---|---|---|---|---|
| 1 | **AgentDeck** | Agent control (K1–K4 p1) | [github.com/puritysb/AgentDeck](https://github.com/puritysb/AgentDeck) | ✅ Modern v2 | Runs a daemon (port 9120) + thin-client plugin. macOS 15+. Most involved install — see below. |
| 2 | **stream-deck-ai-limits** | AI usage/limits (K7 p1) | [github.com/lenadweb/stream-deck-ai-limits](https://github.com/lenadweb/stream-deck-ai-limits) | ✅ Modern v2 | Auto-reads Claude/Codex CLI creds. Supports dials. |
| 3 | **stream-deck-ical** | Next meeting (K6 p2) | [github.com/pedrofuentes/stream-deck-ical](https://github.com/pedrofuentes/stream-deck-ical) | ✅ Modern v2 | Add your Google/Outlook/iCloud iCal URL. Countdown + color warnings. |
| 4 | **essentials-for-spotify** | Media (K5/K6 p3, dials) | [github.com/ntanis-dev/essentials-for-spotify](https://github.com/ntanis-dev/essentials-for-spotify) | ✅ Modern v2 | Requires Spotify Premium. In-browser OAuth setup. |
| 5 | **streamdeck-jira** | Tasks assigned (K4 p2) | [github.com/mediabounds/streamdeck-jira](https://github.com/mediabounds/streamdeck-jira) | ⚠️ 3rd-party framework | Built on `@fnando/streamdeck`, not Elgato SDK. Low activity but works. JQL-driven counts. |
| 6 | **github-stats** (custom) | PRs/CI/tasks (K1–K4 p2) | `plugins/github-stats/` (this repo) | ✅ Modern v2 | We build this. GitHub API. See its README. |
| 7 | **slack-unread** (custom) | Slack unread (K5 p2) | `plugins/slack-unread/` (this repo) | ✅ Modern v2 | We build this. Slack API. `streamdeck-slack-status` (2022) only *sets* status, doesn't count unread. |
| 8 | **weekly-metrics** (custom) | Metrics (K4 p3) | `plugins/weekly-metrics/` (this repo) | ✅ Modern v2 | We build this. WakaTime + GitHub + Calendar. |

### Considered but not chosen

- **codex-stream-deck**, **codex-micro-emulator**, **terminaldeck** — overlap
  with AgentDeck; two use fragile custom integrations (app-shim / raw HID).
- **ellreka/streamdeck-slack-status** — stale (2022), and only *sets* status.
  We do status-set via a script and unread via a custom plugin instead.
- **tjluoma/icalbuddy-km** — 2020, macOS/Keyboard-Maestro only; `stream-deck-ical`
  supersedes it.
- **Lovely-Sim-Racing/lovely-streamdeck-icons** — sim-racing themed, CC BY-NC-SA
  (non-commercial). Fine as a personal icon reference; we keep our own in `icons/`.

## Installing a plugin from GitHub (not the Marketplace)

Most of the modern-SDK GitHub plugins ship a packaged `.streamDeckPlugin` in
their **Releases**. Prefer that:

```sh
# Download the release asset, then double-click it, or:
open "SomePlugin.streamDeckPlugin"   # macOS installs it into the app
```

If a repo has no packaged release, build it with the Elgato CLI:

```sh
npm install -g @elgato/cli     # the `streamdeck` CLI
git clone <repo> && cd <repo>
npm install
npm run build      # or: streamdeck pack
streamdeck link    # sideload the built plugin into the app for dev
```

## Custom plugins (this repo)

The custom plugins (`github-stats`, and later `slack-unread`, `weekly-metrics`)
live in the repo-root **pnpm workspace** (under `streamdeck/plugins/*`, alongside
the `streamdeck/scripts` package), following the Form Factory devtools standard:
a shared `catalog` for
versions, supply-chain hardening (`ignoreScripts`, `minimumReleaseAge`) in
`pnpm-workspace.yaml`, and `vite-plus` (`vp`) for `check` (oxfmt + oxlint +
typecheck) and `test`, with `tsdown` for bundling and TypeScript 7.

```sh
pnpm install          # at the repo root — installs the whole workspace
pnpm run check        # oxfmt + oxlint + typecheck across all packages
pnpm test             # vitest across all packages
pnpm -C streamdeck/plugins/github-stats run build   # bundle one plugin -> its .sdPlugin/bin
```

## AgentDeck setup (most involved)

AgentDeck is a system, not just a plugin: a **daemon** that watches your agent
sessions plus **thin-client** surfaces (the Stream Deck plugin is one). High
level (confirm against the repo's current README, which is the source of truth):

```sh
# 1. Install/run the daemon (it exposes a local API on port 9120)
#    Follow the repo README — typically an npm package / CLI you run at login.
# 2. Install the Stream Deck plugin from AgentDeck's release .streamDeckPlugin
# 3. Point the plugin at the daemon (localhost:9120) in the Property Inspector
# 4. Start your agents (Claude Code / Codex / OpenCode); AgentDeck auto-detects sessions
```

Run the daemon at login via `launchd` (a sample plist can live in this repo once
you confirm the exact daemon entrypoint).

## Secrets

Custom plugins and scripts read tokens from `~/.config/streamdeck/secrets.env`
(git-ignored — see repo root `.gitignore`). `install.sh` creates a template.
Never put tokens in the Elgato profile or in this repo.

Required keys (fill what you use):

```sh
GITHUB_TOKEN=          # PAT or `gh auth token`; scopes: repo, read:org
SLACK_TOKEN=           # user OAuth token; scopes: users.profile:write, channels:read, etc.
WAKATIME_API_KEY=      # from wakatime.com/settings/api-key
JIRA_BASE_URL=         # https://yourorg.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
ICAL_URL=              # private iCal feed for stream-deck-ical (or set in its PI)
```
