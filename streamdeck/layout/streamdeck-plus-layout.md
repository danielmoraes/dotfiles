# Stream Deck + layout

Hardware: **8 LCD keys** (2 rows × 4) + a **4-dial touch strip** at the bottom.

The 8 keys are too few for everything at once, so the deck uses **profile pages**
(a folder/next-page key flips between them). Dials are shared context where it
makes sense but can be re-bound per page.

Legend: `[K1]…[K8]` keys, `(D1)…(D4)` dials. `→` = press action, `⟳` = rotate,
`◉` = touch/tap on LCD.

---

## Page 1 — Agents (home)

The default page. Driving Claude Code / Codex / pi and switching context.

```
[K1] Agent status     [K2] Claude Code     [K3] Codex           [K4] pi
     (AgentDeck)           launch/attach        launch/attach        launch/attach

[K5] Switch account   [K6] Summon Claude   [K7] AI limits       [K8] ▶ Page 2
     (script)             (script)             (ai-limits)          (next page)
```

- **K1 Agent status** — AgentDeck live session indicator (waiting/working/idle).
  Press = interrupt / focus the active session.
- **K2–K4** — launch or attach each agent CLI in a terminal. Uses
  `scripts/summon-agent.sh <claude|codex|pi>`.
- **K5 Switch account** — `scripts/switch-claude-account.sh` (cycles configured
  accounts; the key title can show the active one via title-refresh).
- **K6 Summon Claude** — opens a terminal in the current repo and starts Claude
  Code with a prepped prompt (`scripts/summon-claude.sh`).
- **K7 AI limits** — `stream-deck-ai-limits` plugin, Claude usage + reset.

**Dials on Page 1:**
- `(D1)` ⟳ Agent reasoning depth / model tier · → toggle Fast mode
- `(D2)` ⟳ Scroll agent output / history · → submit
- `(D3)` ⟳ Volume · → mute
- `(D4)` ⟳ Pomodoro timer (⟳ set minutes) · → start/pause · LCD shows remaining

---

## Page 2 — Work dashboard (read-only status)

Glanceable state. These keys mostly *display*; pressing opens the relevant app.

```
[K1] PRs to review    [K2] My open PRs     [K3] CI status       [K4] Tasks assigned
     (github-stats)       (github-stats)       (github-stats)       (jira / github)

[K5] Slack unread     [K6] Next meeting    [K7] Slack status    [K8] ▶ Page 3
     (custom)             (stream-deck-ical)   (set: script)        (next page)
```

- **K1 PRs to review** — count of PRs requesting your review; red if > 0. Press
  opens the GitHub review queue.
- **K2 My open PRs** — count of your open PRs; amber if any have failing checks.
- **K3 CI status** — green/red for your watched repos' default branch.
- **K4 Tasks assigned** — Jira issues assigned to you (count) via
  `streamdeck-jira`, or GitHub issues via `github-stats`.
- **K5 Slack unread** — count of unread mentions/DMs (custom plugin).
- **K6 Next meeting** — `stream-deck-ical`; title + countdown, color escalates as
  it approaches. Press launches the calendar/meeting link.
- **K7 Slack status** — set/clear status (🟢 available / 🔴 focus / 🍽 lunch).

**Dials on Page 2:**
- `(D1)` ⟳ cycle watched repos (K1–K3 refocus on the selected repo)
- `(D2)` ⟳ scroll the meeting list on the LCD
- `(D3)` ⟳ Volume · → mute
- `(D4)` ⟳ Pomodoro (shared with Page 1)

---

## Page 3 — Modes, media & metrics

```
[K1] Focus mode       [K2] Meeting mode    [K3] Quick capture   [K4] Weekly metrics
     (script)             (script)             (script)             (custom, cycles)

[K5] Spotify play     [K6] Spotify next    [K7] Standup helper  [K8] ▶ Page 1
     (spotify)            (spotify)            (script)             (home)
```

- **K1 Focus mode** — `scripts/focus-mode-toggle.sh`: macOS Focus on, quit/hush
  Slack, start focus playlist, set Slack status to 🔴.
- **K2 Meeting mode** — `scripts/meeting-mode.sh`: mute mic, DND, pause music.
- **K3 Quick capture** — `scripts/quick-capture.sh`: append a line to your inbox
  / create a GitHub issue.
- **K4 Weekly metrics** — custom plugin; press cycles WakaTime hours → PRs merged
  → meetings attended this week.
- **K5/K6 Spotify** — `essentials-for-spotify` plugin.
- **K7 Standup helper** — `scripts/standup.sh`: summarize yesterday's merged PRs
  and commits to the clipboard.

**Dials on Page 3:**
- `(D1)` ⟳ Spotify volume · → play/pause
- `(D2)` ⟳ Spotify seek/next · → like
- `(D3)` ⟳ Screen/Key Light brightness (if Elgato lights present)
- `(D4)` ⟳ Pomodoro (shared)

---

## Notes on realizing this in the Elgato app

- Pages are implemented either as **separate profiles** with a "Switch Profile"
  key, or as **folders** (Create Folder action) within one profile. Folders are
  simpler for a linear K8 "next page" flow; profiles are better if you want an
  app-specific profile to auto-activate (e.g. a "Meeting" profile when Zoom is
  frontmost).
- Any key labeled *(script)* uses **System → Open** pointed at the matching file
  in `scripts/` (after `install.sh` links them into `~/.local/bin`), or the
  **BetterTouchTool / "Open"** action. Keep the profile thin — logic lives in the
  scripts.
- Keys labeled *(plugin name)* come from the installed plugins in
  `plugins/README.md`.
- **Title refresh:** for keys that should show live values but aren't a full
  plugin (active Claude account, Pomodoro remaining), a small
  `launchd`/cron job can rewrite the key title via the plugin's settings — noted
  per-script where relevant.
