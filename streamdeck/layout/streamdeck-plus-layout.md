# Stream Deck + layout

Hardware: **8 LCD keys** (2 rows × 4) + a **4-dial touch strip** at the bottom.

This document is the _why_. The machine-readable twin — and what actually gets
written to the deck — is [`../profiles/src/layout.ts`](../profiles/src/layout.ts).
Change both together.

The 8 keys are too few for everything at once, so the deck uses the app's
**native pages**: one `Dotfiles` profile with 3 pages, and K8 on every page
bound to _Next Page_ so the three cycle. Dials are shared where it makes sense
and re-bound per page where it doesn't.

Legend: `[K1]…[K8]` keys, `(D1)…(D4)` dials. `→` = press, `⟳` = rotate.

---

## Page 1 — Agents (home)

The default page. Driving Claude Code / Codex / pi and switching context.

```
[K1] Agent status     [K2] Claude          [K3] Codex           [K4] pi
     (AgentDeck)           summon-agent         summon-agent         summon-agent

[K5] Account          [K6] Summon          [K7] Claude limits   [K8] Work ▶
     (script)              (script)             (ai-limits)          (next page)
```

- **K1 Agent status** — AgentDeck _Session Slot_: which agent is running, in
  which project, and whether it's working, waiting or idle. Press to jump in.
- **K2–K4** — `sd-summon-agent <claude|codex|pi>`; launches the CLI in a terminal.
- **K5 Account** — `sd-switch-claude-account`, cycles configured accounts.
- **K6 Summon** — `sd-summon-claude`, opens a terminal in the current repo.
- **K7 Claude limits** — `com.len.limits.progress`, usage + reset window.

**Dials (Pages 1 & 2 share these):**

- `(D1)` AgentDeck **Claude usage** — quota on the LCD strip
- `(D2)` AgentDeck **Codex usage**
- `(D3)` AgentDeck **Volume** · → mute
- `(D4)` AgentDeck **Launcher** — ⟳ pick an agent/project, → start a session

---

## Page 2 — Work dashboard (read-mostly status)

Glanceable state. These keys mostly _display_; pressing opens the relevant app.

```
[K1] PRs to review    [K2] My open PRs     [K3] CI status       [K4] Jira
     (github-stats)       (github-stats)       (github-stats)       (JQL result)

[K5] Slack unread     [K6] Next meeting    [K7] Slack status    [K8] Modes ▶
     (slack-unread)       (calendar)           (script)             (next page)
```

- **K1 PRs to review** — `is:open is:pr review-requested:@me`; red at ≥ 1.
  Press opens the GitHub review queue.
- **K2 My open PRs** — `is:open is:pr author:@me`.
- **K3 CI status** — latest Actions conclusion for `danielmoraes/dotfiles@main`.
- **K4 Jira** — issues matching a JQL query (default: assigned to you, not
  done); red at ≥ 1. Press opens the query in Jira. Credentials come from
  `secrets.env`.
- **K5 Slack unread** — Slack's own badge (DMs + mentions), read from the
  desktop app's local state. Red at ≥ 1. Press opens Slack. Needs no token —
  see the plugin README for why the API route is closed.
- **K6 Next meeting** — local macOS Calendar via the `calendar` plugin; title +
  countdown, amber inside 10 minutes. No feed URL or token — see its README for
  why an `.ics` feed wasn't viable.
- **K7 Slack status** — `sd-slack-status` cycles 🟢 available → 🔴 focus →
  🍽 lunch → clear. Pass a preset name to jump straight to one.

**Dials:** same as Page 1, so agent quota stays visible from both working pages.

---

## Page 3 — Modes, media & metrics

```
[K1] Focus mode       [K2] Meeting mode    [K3] Quick capture   [K4] Weekly metrics
     (script)             (script)             (script)             (weekly-metrics)

[K5] Play / Pause     [K6] Next song       [K7] Standup         [K8] Agents ▶
     (spotify)            (spotify)            (script)             (home)
```

- **K1 Focus mode** — `sd-focus-mode`: macOS Focus, Slack status, focus playlist.
- **K2 Meeting mode** — `sd-meeting-mode`: mute mic, DND, pause music.
- **K3 Quick capture** — `sd-quick-capture`: append to your inbox / open an issue.
- **K4 Weekly metrics** — press cycles coding hours → PRs merged → meetings
  (meetings also come from the local calendar).
- **K5/K6 Spotify** — `essentials-for-spotify`.
- **K7 Standup** — `sd-standup`: yesterday's merged PRs and commits to the clipboard.

**Dials on Page 3** hand over to media:

- `(D1)` Spotify **Playback control** — ⟳ seek · → play/pause
- `(D2)` Spotify **Volume**
- `(D3)` Spotify **My playlists** — ⟳ browse · → play
- `(D4)` AgentDeck **Volume** (system volume, shared with pages 1–2)

---

## Notes

- **Pages, not folders or separate profiles.** Stream Deck 7.x has real pages,
  so one profile holds all three and K8 (_Next Page_) cycles them. A
  profile-per-page would only be worth it to auto-activate one per app.
- Keys labelled _(script)_ run the built `sd-*` command in `~/.local/bin` via
  the `commands` plugin (see [`../scripts/`](../scripts/README.md)). Not Elgato's
  **Open** action: that runs `open <path>`, which hands an extension-less script
  to your terminal app instead of executing it.
- Keys labelled _(plugin)_ come from [`../plugins/README.md`](../plugins/README.md).
- **Secrets.** The app launches plugins and scripts with the _login_
  environment, not your shell's — so both load
  `~/.config/streamdeck/secrets.env` themselves via
  [`../secrets/`](../secrets/src/index.ts). GitHub falls back to `gh auth token`
  when `GITHUB_TOKEN` is blank.
