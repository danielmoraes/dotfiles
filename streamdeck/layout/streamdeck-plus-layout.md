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

The default page: every live Claude Code session at once.

```
[K1] Session 0        [K2] Session 1       [K3] Session 2       [K4] Session 3
     (AgentDeck)          (AgentDeck)          (AgentDeck)          (AgentDeck)

[K5] Session 4        [K6] Session 5       [K7] Session 6       [K8] Work ▶
     (AgentDeck)          (AgentDeck)          (AgentDeck)          (next page)
```

Each key is an AgentDeck _Session Slot_: which session is running, in which
project, and whether it's working, waiting or idle. Press to jump in.

This mirrors AgentDeck's own recommended Stream Deck + profile, which is eight
slots and nothing else — one short here, because K8 has to advance the page.

- **Slots are positional.** The plugin derives the index from the key's
  coordinates (`row * columns + col`), not from its settings, so K1–K7 are
  sessions 0–6 and moving a key moves which session it watches.
- **Nothing on this page launches an agent.** Claude Code gets started from a
  terminal, so the old `sd-summon-agent` / `sd-summon-claude` keys were dead
  weight. Both scripts still exist — they're just not bound to a key.

**Dials (Pages 1 & 2 share these):**

- `(D1)` AgentDeck **Claude usage** — quota on the LCD strip. ⟳ cycles the
  window: both → 5h → 7d → session · → refresh
- `(D2)` AgentDeck **Volume** · → mute
- `(D3)` AgentDeck **Launcher** — ⟳ pick a project, → start a session
- `(D4)` Spotify **Playback control** — ⟳ seek · → play/pause

Only Claude runs here, so AgentDeck's Codex gauge is gone. It can't be pointed
at Claude instead: the plugin fixes each dial's role to its action UUID
(`option-dial` = Claude, `iterm-dial` = Codex, `utility-dial` = volume). The one
Claude gauge covers every window on its own, which frees `(D4)` for media.

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
- **K7 Slack status** — shows your current status, read back from Slack. Press
  cycles Online → 🔕 Focus → Away. Focus snoozes notifications for 90 min
  (`dnd:write`); Away is a real presence change (`users:write`). Pass a preset
  name to `sd-slack-status` to jump straight to one.

**Dials:** same as Page 1, so Claude quota stays visible from both working pages.

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
