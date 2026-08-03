# Plugins

What's installed, where it comes from, and how each is wired. "Modern SDK" =
Elgato's official Node.js SDK v2 (`@elgato/streamdeck`, manifest `SDKVersion: 3`,
Stream Deck app 6.9+).

## Installed

| #   | Plugin                     | UUID                              | Used on          | Source                                                                                    | SDK                    |
| --- | -------------------------- | --------------------------------- | ---------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **AgentDeck**              | `bound.serendipity.agentdeck`     | P1 K1 + dials    | [puritysb/AgentDeck](https://github.com/puritysb/AgentDeck)                               | ✅ v3                  |
| 2   | **AI Usage Limits**        | `com.len.limits`                  | P1 K7            | [lenadweb/stream-deck-ai-limits](https://github.com/lenadweb/stream-deck-ai-limits)       | ✅ v3                  |
| 4   | **Essentials for Spotify** | `com.ntanis-dev…`                 | P3 K5/K6 + dials | [ntanis-dev/essentials-for-spotify](https://github.com/ntanis-dev/essentials-for-spotify) | ✅ v3                  |
| 5   | **Jira**                   | `com.mediabounds.streamdeck.jira` | P2 K4            | [mediabounds/streamdeck-jira](https://github.com/mediabounds/streamdeck-jira)             | ⚠️ 3rd-party framework |
| 6   | **github-stats**           | `com.dmoraes.github-stats`        | P2 K1–K3         | [`github-stats/`](github-stats/) (this repo)                                              | ✅ v3                  |
| 7   | **slack-unread**           | `com.dmoraes.slack-unread`        | P2 K5            | [`slack-unread/`](slack-unread/README.md) (this repo)                                     | ✅ v3                  |
| 8   | **weekly-metrics**         | `com.dmoraes.weekly-metrics`      | P3 K4            | [`weekly-metrics/`](weekly-metrics/README.md) (this repo)                                 | ✅ v3                  |
| 9   | **calendar**               | `com.dmoraes.calendar`            | P2 K6            | [`calendar/`](calendar/README.md) (this repo)                                             | ✅ v3                  |

Action UUIDs for each are in
[`../profiles/src/layout.ts`](../profiles/src/layout.ts) — that file is the only
place they're referenced.

### Considered but not chosen

- **codex-stream-deck**, **codex-micro-emulator**, **terminaldeck** — overlap
  with AgentDeck; two use fragile custom integrations (app-shim / raw HID).
- **ellreka/streamdeck-slack-status** — stale (2022), and only _sets_ status.
  We set status via `sd-slack-status` and count unread via `slack-unread`.
- **stream-deck-ical** — needs a private `.ics` feed URL. Google Workspace
  disables the per-calendar secret address on managed domains, leaving only the
  _public_ address, so there is nothing safe to point it at. Replaced by the
  local-calendar `calendar` plugin above.
- **Slack's `users.counts` API** — returns `not_allowed_token_type` for modern
  `xoxp-` tokens; the legacy `client` scope it needs can't be granted any more.
  `slack-unread` reads the desktop app's local state file instead.

## Custom plugins (this repo)

They live in the repo-root **pnpm workspace** under `streamdeck/plugins/*`:
a shared `catalog` for versions, supply-chain hardening (`ignoreScripts`,
`minimumReleaseAge`) in `pnpm-workspace.yaml`, `vite-plus` (`vp`) for `check`
(oxfmt + oxlint) and `test`, and `tsdown` for bundling.

```sh
pnpm install          # at the repo root — installs the whole workspace
pnpm run check        # oxfmt + oxlint across all packages
pnpm test             # vitest across all packages
pnpm run build        # bundle every plugin -> its .sdPlugin/bin/plugin.js
```

Each builds to a single self-contained `bin/plugin.js` inside its `.sdPlugin`
folder, which is symlinked into the app's `Plugins/` directory — so a rebuild is
picked up by restarting the app, with no re-install.

```sh
dest=~/"Library/Application Support/com.elgato.StreamDeck/Plugins/com.dmoraes.github-stats.sdPlugin"
# Remove first: `ln -sfn` replaces a symlink but not a real directory — it would
# put the link *inside* it and the app would keep loading the stale copy.
rm -rf "$dest"
ln -s "$PWD/streamdeck/plugins/github-stats/com.dmoraes.github-stats.sdPlugin" "$dest"
```

### Key colours

Two-state keys use the accent rule at the bottom of the key image: **blue = quiet**,
**red = needs attention** (count at/above `warnAt`; for the calendar key, amber
inside `warnMinutes`). The state is set by the plugin from live data.

Any action with more than one `States` entry **must** set
`"DisableAutomaticStates": true`. Without it the Stream Deck app toggles the
state itself on every press, so the colour flips to whatever is next in the list
and no longer reflects the data until the following refresh.

### Manifest gotchas

Learned the hard way — the app rejects a plugin silently apart from one line in
`~/Library/Logs/ElgatoStreamDeck/StreamDeck.0.log`:

- **`UUID` is required**, and every action UUID must be **prefixed by it**.
  `com.x.plugin` + `org.x.plugin.action` fails to load.
- **`CategoryIcon` is required whenever `Category` is set** — the failure reads
  `Plugin invalid '<uuid>': (category icon not defined)`.
- The plugin **`Icon` must be PNG** (256 + 512 `@2x`). Every other image slot
  takes SVG. See [`../icons/`](../icons/README.md).
- **`DisableAutomaticStates` defaults to `false`** — see the section above.

## Icons

Action and key images are hand-authored SVGs inside each `.sdPlugin/imgs/`. The
PNG plugin icons are generated — see [`../icons/`](../icons/README.md).

## AgentDeck setup

AgentDeck is a daemon plus thin-client surfaces; the Stream Deck plugin is one
of them. With no daemon running the keys show an OFFLINE state.

```sh
npx @agentdeck/setup        # installs the `agentdeck` CLI + daemon + agent hooks
agentdeck daemon install    # LaunchAgent so the daemon starts at login
agentdeck status            # should report the daemon on :9120
```

The setup step appends hooks to `~/.claude/settings.json` (it backs the file up
first and leaves existing hooks alone).

## Secrets

Plugins read tokens from `~/.config/streamdeck/secrets.env` (git-ignored) via
[`../secrets/`](../secrets/src/index.ts) — the Stream Deck app launches them
with the login environment, not your shell's, so nothing exported from a shell
rc is visible to them.

```sh
GITHUB_TOKEN=          # optional — falls back to `gh auth token`
GITHUB_LOGIN=          # only for weekly-metrics' `commits` metric
SLACK_TOKEN=           # user token (xoxp-), for sd-slack-status / sd-focus-mode
WAKATIME_API_KEY=      # wakatime.com/settings/api-key
ICAL_URL=              # private iCal feed
```

Jira is **not** configured from this file — `streamdeck-jira` stores its domain,
email, API token and JQL in its own Property Inspector, on the key itself. Get
an API token from
[id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
The calendar keys need no token at all — they read the local Calendar store,
which needs `brew install ical-buddy` and a one-off macOS Calendar grant to the
Stream Deck app.
