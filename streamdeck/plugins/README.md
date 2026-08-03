# Plugins

What's installed, where it comes from, and how each is wired. "Modern SDK" =
Elgato's official Node.js SDK v2 (`@elgato/streamdeck`, manifest `SDKVersion: 3`,
Stream Deck app 6.9+).

## Installed

| #   | Plugin                     | UUID                          | Used on          | Source                                                                                    | SDK   |
| --- | -------------------------- | ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------- | ----- |
| 6   | **github-stats**           | `com.dmoraes.github-stats`    | P2 K1–K3         | [`github-stats/`](github-stats/) (this repo)                                              | ✅ v3 |
| 7   | **slack-unread**           | `com.dmoraes.slack-unread`    | P2 K5            | [`slack-unread/`](slack-unread/README.md) (this repo)                                     | ✅ v3 |
| 8   | **weekly-metrics**         | `com.dmoraes.weekly-metrics`  | P3 K4            | [`weekly-metrics/`](weekly-metrics/README.md) (this repo)                                 | ✅ v3 |
| 9   | **calendar**               | `com.dmoraes.calendar`        | P2 K6            | [`calendar/`](calendar/README.md) (this repo)                                              | ✅ v3 |
| 10  | **commands**               | `com.dmoraes.commands`        | P1/P3 scripts    | [`commands/`](commands/) (this repo)                                                      | ✅ v3 |
| 11  | **jira**                   | `com.dmoraes.jira`            | P2 K4            | [`jira/`](jira/) (this repo)                                                              | ✅ v3 |
| 12  | **cswap**                  | `com.dmoraes.cswap`           | D1               | [`cswap/`](cswap/README.md) (this repo)                                                   | ✅ v3 |
| 13  | **sessions**               | `com.dmoraes.sessions`        | P1 K1–K7         | [`sessions/`](sessions/README.md) (this repo)                                             | ✅ v3 |

Action UUIDs for each are in
[`../profiles/src/layout.ts`](../profiles/src/layout.ts) — that file is the only
place they're referenced.

**Everything on the deck is now built here.** The last third-party plugin
(`essentials-for-spotify`, P3 K5/K6) went when Spotify stopped being the player
on this machine; those two keys are open rather than repointed, because the
player that took over ignores every generic media command. See
[_Considered but not chosen_](#considered-but-not-chosen) below.

So there is **nothing to install by hand** — `install.sh` builds and links every
plugin the deck binds, and no longer prints a download checklist. It listed four
for a while, and each was replaced or dropped: `stream-deck-ical` by `calendar`,
`mediabounds/streamdeck-jira` by `jira`, and the Spotify and quota-gauge plugins
by the removals below. A `com.dmoraes.` prefix on every action UUID is asserted
in [`../profiles/src/profile.test.ts`](../profiles/src/profile.test.ts), so a
third-party plugin sneaking back into the layout fails the suite.

**cswap** holds D1, and is the only Claude-quota dial left: usage limits for
_every_ managed account, which is active, and a press to switch. Two dials that
each showed only the signed-in account's quota were dropped as duplicates of it.

**AgentDeck is gone entirely** — plugin and daemon both. Page 1's session keys
were the last thing using it, and [`sessions`](sessions/README.md) reads the
same facts straight out of `~/.claude/`, more accurately. Nothing on this deck
now depends on a background service of any kind.

**D4 (System volume)** isn't a plugin at all — it's Elgato's built-in
`com.elgato.streamdeck.system.multimedia` system action, which sends real
macOS media-key events instead of going through a plugin's own daemon or SDK.
D2 and D3 are open: AgentDeck's Launcher wasn't reached for, and a
media-transport dial tried in its place doesn't work against Focus@Will —
confirmed a genuine Focus@Will bug, not an `actionIdx` guess gone wrong. See
[`../layout/streamdeck-plus-layout.md`](../layout/streamdeck-plus-layout.md#dials-every-page)
for both.

### Considered but not chosen

- **Essentials for Spotify** (`com.ntanis-dev…`) — held P3 K5/K6 (play-pause,
  next song) until Spotify stopped being the player here. Not replaced with a
  generic media key: the player that took over is Focus@Will, which swallows
  every media command on every sender — see the dial note above. The slots are
  open, and `sd-focus-mode` / `sd-meeting-mode` lost their Spotify AppleScript
  for the same reason, plus a sharper one: `tell application "Spotify"` starts
  the app if it isn't running, so on a Mac without it the key launched
  something you don't use.
- **AI Usage Limits** (`com.len.limits`) and **AgentDeck's Claude gauge**
  (`option-dial`) — both held a dial showing the quota of whichever account
  you're signed in as, which meant two dials answering the same question, then
  a third once `cswap` arrived. `cswap` covers that account as one row of
  several and needs no daemon, so both were dropped.
- **Forking AgentDeck** to add multi-account support — it's MIT and already ran
  a dial here, so it was the obvious base. But it has no multi-account concept:
  its model is one linked account per _provider_, reading whatever that CLI is
  signed into. Adopting its Swift daemon and bridge protocol to add what the
  `cswap` CLI already answers in a single JSON call wasn't a good trade.
- **Keeping AgentDeck's `session-slot`** for page 1 — the action has no
  Property Inspector and takes no settings, so its layout couldn't be changed:
  a big Claude watermark, the state written out three times, and identity
  clipped to 13 characters of a field holding the worktree slug rather than the
  repo. Drawing the key ourselves was the smaller job.
- **Keeping its daemon as the data source**, once the key was ours. Two of the
  fields it served were unusable — `contextPercent` divides by a hardcoded
  200 000, so a session at 28% of a 1M window read as 140% — and everything
  else it knew turned out to be in `~/.claude/` already, including the
  `/rename` name it has no concept of. See [`sessions/`](sessions/README.md).
- **codex-stream-deck**, **codex-micro-emulator**, **terminaldeck** — overlap
  with AgentDeck; two use fragile custom integrations (app-shim / raw HID).
- **ellreka/streamdeck-slack-status** — stale (2022), and only _sets_ status.
  We set status via `sd-slack-status` and count unread via `slack-unread`.
- **mediabounds/streamdeck-jira** — works, and tracks the current API, but keeps
  a second copy of your Jira credentials in its Property Inspector. Replaced by
  the `jira` plugin above, which reads the ones already in `secrets.env`.
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

## Removing AgentDeck

Nothing on the deck uses it any more. If it's still installed from before:

```sh
agentdeck daemon uninstall   # remove the LaunchAgent
```

Then delete `bound.serendipity.agentdeck.sdPlugin` from the Stream Deck app,
and take its hooks out of `~/.claude/settings.json` — `SessionStart`,
`SessionEnd`, `UserPromptSubmit`, `Notification`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure` and `Stop` each carry a `curl` to `127.0.0.1:9120`.

Worth doing rather than leaving: `PreToolUse` and `Stop` are **blocking**
(`--max-time` 60s and 10s), so every tool call in every Claude Code session
waits on a round-trip to a daemon nothing reads any more.

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

Jira reads `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` from this file like
everything else. Get an API token from
[id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

**Counting issues:** `/rest/api/3/search` was removed by Atlassian and now
answers `410`; `/search/jql` replaces it but returns token-paginated issues with
no total. A plain count has to come from
`/rest/api/3/search/approximate-count`.
The calendar keys need no token at all — they read the local Calendar store,
which needs `brew install ical-buddy` and a one-off macOS Calendar grant to the
Stream Deck app.
