# Stream Deck + layout

Hardware: **8 LCD keys** (2 rows × 4) + a **4-dial touch strip** at the bottom.

This document is the _why_. The machine-readable twin — and what actually gets
written to the deck — is [`../profiles/src/layout.ts`](../profiles/src/layout.ts).
Change both together.

The 8 keys are too few for everything at once, so the deck uses the app's
**native pages**: one `Dotfiles` profile with 3 pages, and K8 on every page
bound to _Next Page_ so the three cycle. The 4 dials are the **same on every
page** — unlike keys, dials are steady-state controls you reach for without
looking, so which one is volume shouldn't depend on which page happens to be
showing.

Legend: `[K1]…[K8]` keys, `(D1)…(D4)` dials. `→` = press, `⟳` = rotate.

---

## Dials (every page)

```
(D1) Claude accounts   (D2) —               (D3) —               (D4) System volume
     cswap                  open                 open                 media keys
```

- **D1 Claude accounts** — `com.dmoraes.cswap.accounts`: a row per managed
  account with its usage bar, the active one marked by a filled dot. ⟳ changes
  the window (5h → 7d → spend) · → switches account. See the
  [plugin README](../plugins/cswap/README.md).
- **D4 System volume** — macOS's hardware media-key path (Elgato's built-in
  "Multimedia" action, not a plugin), not AgentDeck's dial. ⟳ volume · → mute.

Two dials for two jobs, and two slots left open rather than filled for the sake
of it. Three Claude-quota dials have been through here:

- **AgentDeck's gauge** (`option-dial`) — the original D1. ⟳ cycled both → 5h →
  7d → session. Dropped once `cswap` landed: it only ever showed the account
  you're signed in as, which `cswap` covers as one row of several. Its
  "session" rotation was already dead weight — it reads 0/0 unless the session
  was started through the `agentdeck` CLI wrapper, and these start as plain
  `claude`.
- **AI Usage Limits** (`com.len.limits.progress`) — taken on as a
  daemon-independent second readout, dropped for the same duplication.
- **cswap** — what's left. The useful question when you run two accounts is
  "how much is left on the _other_ one, and can I jump to it", which is the one
  neither of the others could answer.

Dropping AgentDeck's gauge took its daemon out of the dial strip; page 1's
session keys later moved off it too, and the daemon is now gone from the deck
altogether.

Two more things were tried in the open slots and pulled:

- **Launcher** (AgentDeck) — not reached for, same reasoning as the old launch
  keys.
- **Media transport** (rotate = prev/next, press = play/pause, same built-in
  action as D4) — doesn't reach Focus@Will. Confirmed two ways: `nowplaying-cli
  pause` is a no-op (elapsed time keeps climbing right through it), and
  clicking Pause on Focus@Will's own card in macOS Control Center does nothing
  either. The command genuinely doesn't work on any sender — this isn't the
  dial's `actionIdx` guess landing on the wrong built-in mode. Root cause:
  Focus@Will's Chromium layer registers itself as macOS's Now Playing app
  (hence live title/artist/elapsed time), but never wires up a working
  play/pause command handler, so every press — hardware key, Control Center,
  or a Stream Deck dial — gets swallowed by that broken registration before it
  can reach the app's own `globalShortcut.register("MediaPlayPause", …)`
  listener, which is what would have actually worked. A genuine Focus@Will
  bug, not fixable from the Stream Deck side.

No part of the deck depends on the AgentDeck daemon any more. Only Claude runs
here, so AgentDeck's Codex gauge is gone entirely too — the
plugin fixes each dial's role to its action UUID (`option-dial` = Claude,
`iterm-dial` = Codex, `utility-dial` = volume), so Codex's slot couldn't be
repointed at anything else and had to go. System volume moved off
`utility-dial` for the same reason from the other direction: that dial goes
dead — rotate does nothing, press opens an app — whenever the daemon isn't
running, which has nothing to do with the system volume it's supposed to
control. Its `actionIdx: 18` matches Elgato's own shipped
`StreamDeckPlus_macDefault` profile exactly, labelled "System Volume".

---

## Page 1 — Agents (home)

The default page: every live Claude Code session at once.

```
[K1] Session 0        [K2] Session 1       [K3] Session 2       [K4] Session 3
     (sessions)           (sessions)           (sessions)           (sessions)

[K5] Session 4        [K6] Session 5       [K7] Session 6       [K8] Work ▶
     (sessions)           (sessions)           (sessions)           (next page)
```

Each key is one live session:

```
┌────────────────┐  ← teal dash orbiting  = running
│                │    amber ring breathing = wants you
│  stream deck   │    hairline             = idle
│  steward       │  the name you gave it, over the repo
│                │
│  ▓▓▓▓▓▓▓▓░ 87% │  context window
│  21m · 16:06   │  running for · started at      s002 ← terminal
└────────────────┘
```

Unnamed, it's the repo on top and the worktree below:

```
┌────────────────┐
│  steward       │
│  ⑂ calm-mappi… │
```

`/rename` a session and its name takes the top line, with the repo beneath it —
the fastest way to tell two keys in the same repo apart. Failing that the repo
leads and the worktree slug goes below. The terminal in the corner is what
leads back to the actual window.

Eight slots and nothing else is AgentDeck's own recommended Stream Deck +
profile, and the shape was kept — one short here, because K8 has to advance the
page.

- **Nothing behind these keys but files.** `sessions` reads
  `~/.claude/sessions/*.json` and each session's transcript — no daemon, no
  hook, no background service. It replaced AgentDeck's `session-slot`, which
  spent a quarter of the key on a Claude watermark, wrote the state out three
  times over, and clipped identity to 13 characters of a field holding the
  _worktree slug_ — with no Property Inspector and no settings, so none of it
  could be turned off. Its daemon went too, once it turned out to be serving
  the same facts less accurately: its context reading divided by a hardcoded
  200 000, so a session at 28% of a 1M window showed as 140%. See
  [the plugin README](../plugins/sessions/README.md).
- **Slots are positional.** The plugin sorts the keys by their coordinates and
  fills them oldest session first, so K1–K7 are sessions 0–6 and moving a key
  moves which session it watches. Oldest-first is what stops a new session
  shuffling every other one along under your finger.
- **Pressing does nothing.** These are readouts. Answering a permission prompt
  from the deck needs a hook holding the tool call open, which went with the
  daemon; in auto mode there is nothing to answer anyway.
- **Nothing on this page launches an agent.** Claude Code gets started from a
  terminal, so the old `sd-summon-agent` / `sd-summon-claude` keys were dead
  weight. Both scripts still exist — they're just not bound to a key.
- **The context bar needs a denominator**, and Claude Code persists it nowhere
  — it hands `context_window_size` to the status line and keeps no copy. So
  `contextWindow` is declared in `layout.ts` (1M here); unset it falls back to
  the same 200 000 Claude Code itself defaults to.

**Dials:** see [above](#dials-every-page) — same on every page.

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

**Dials:** see [above](#dials-every-page) — same on every page.

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
- **K5/K6 Spotify** — `essentials-for-spotify`. Still Spotify-specific; unlike
  the dials above, these weren't in scope for the media-generalisation pass —
  worth a look if Spotify isn't the daily driver here either.
- **K7 Standup** — `sd-standup`: yesterday's merged PRs and commits to the clipboard.

**Dials:** see [above](#dials-every-page) — same on every page.

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
