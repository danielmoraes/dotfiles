/**
 * The deck layout, as data.
 *
 * This is the machine-readable twin of `../layout/streamdeck-plus-layout.md` —
 * that document explains the *why*, this file is what actually gets written to
 * the Stream Deck app. Keep them in step.
 *
 * Every action UUID here is one this repo installs (see `../plugins/README.md`)
 * or an Elgato built-in. Nothing references a plugin that isn't installed.
 */

export type PluginRef = {
  name: string
  uuid: string
  version: string
}

const AGENTDECK: PluginRef = {
  name: "AgentDeck",
  uuid: "bound.serendipity.agentdeck",
  version: "1.0.3.0",
}
const GITHUB_STATS: PluginRef = {
  name: "GitHub Stats",
  uuid: "com.dmoraes.github-stats",
  version: "0.1.0.0",
}
const SLACK_UNREAD: PluginRef = {
  name: "Slack Unread",
  uuid: "com.dmoraes.slack-unread",
  version: "0.1.0.0",
}
const WEEKLY_METRICS: PluginRef = {
  name: "Weekly Metrics",
  uuid: "com.dmoraes.weekly-metrics",
  version: "0.1.0.0",
}
/** Exported: `profile.ts` needs it to serialise the `run` bindings. */
export const COMMANDS: PluginRef = {
  name: "Commands",
  uuid: "com.dmoraes.commands",
  version: "0.1.0.0",
}
const CALENDAR: PluginRef = {
  name: "Calendar",
  uuid: "com.dmoraes.calendar",
  version: "0.1.0.0",
}
const JIRA: PluginRef = {
  name: "Jira",
  uuid: "com.dmoraes.jira",
  version: "0.1.0.0",
}
const SPOTIFY: PluginRef = {
  name: "Essentials for Spotify",
  uuid: "com.ntanis.essentials-for-spotify",
  version: "1.2.0.0",
}
const CSWAP: PluginRef = {
  name: "Claude Accounts",
  uuid: "com.dmoraes.cswap",
  version: "0.1.0.0",
}

/** A key or dial binding. */
export type Binding =
  /** Run one of the repo's `sd-*` commands via the `commands` plugin. */
  | { kind: "run"; command: string; args?: string[]; title: string }
  /** Open a URL in the browser. */
  | { kind: "website"; url: string; title: string }
  /** Advance to the next page of this profile. */
  | { kind: "nextPage"; title: string }
  /**
   * Elgato's built-in "Multimedia" system action — sends real hardware media
   * key events, so it works with whatever app currently holds macOS's Now
   * Playing focus, not one SDK-specific app. `actionIdx` selects its mode; the
   * app ships no manifest listing them, so see `SYSTEM_VOLUME` / `MEDIA_PLAYER`
   * below for how confident each value is.
   */
  | { kind: "multimedia"; actionIdx: number; title: string }
  /** An action provided by an installed plugin. */
  | {
      kind: "plugin"
      plugin: PluginRef
      action: string
      /** Action name as the app labels it; cosmetic but keeps the UI tidy. */
      name: string
      /** Static key title. Omit for actions that render their own. */
      title?: string
      settings?: Record<string, unknown>
    }

export type Page = {
  title: string
  /** 8 keys, in reading order: K1..K4 top row, K5..K8 bottom row. */
  keys: (Binding | null)[]
  /** 4 dials, D1..D4. */
  dials: (Binding | null)[]
}

/**
 * Helper: an `sd-*` command key.
 *
 * The command name is passed bare — the plugin resolves it against
 * `~/.local/bin` itself, because the Stream Deck app runs under launchd with a
 * minimal `PATH`.
 */
function run(command: string, title: string, ...args: string[]): Binding {
  return { kind: "run", command, args, title }
}

/**
 * AgentDeck's session slot: which Claude Code session is running, in which
 * project, and whether it's working, waiting or idle.
 *
 * The slot each key shows is **positional** — the plugin derives the index from
 * the key's own coordinates (`row * columns + col`), not from settings. So the
 * same binding repeated across K1..K7 reads as sessions 0..6, and moving a key
 * moves which session it watches.
 */
const SESSION_SLOT: Binding = {
  kind: "plugin",
  plugin: AGENTDECK,
  action: "bound.serendipity.agentdeck.session-slot",
  name: "Session Slot",
}

/**
 * System output volume, via macOS media keys rather than AgentDeck's dial —
 * `bound.serendipity.agentdeck.utility-dial` goes dead (rotate does nothing,
 * press opens an app) whenever the AgentDeck daemon isn't running, which has
 * nothing to do with the system volume it controls. `actionIdx: 18` is
 * confirmed: it's exactly what Elgato's own shipped `StreamDeckPlus_macDefault`
 * profile puts on a dial, labelled "System Volume".
 */
const SYSTEM_VOLUME: Binding = {
  kind: "multimedia",
  actionIdx: 18,
  title: "System Volume",
}

/**
 * The dial strip — identical on every page.
 *
 * Dials are steady-state controls reached for without looking, unlike keys —
 * so unlike the keys, which are meant to change per page, the same four dials
 * should mean the same thing everywhere. D3 is open, not filled for its own
 * sake — two things were tried there and pulled:
 *
 * - AgentDeck's Codex gauge is gone: only Claude runs here, and the plugin
 *   hardcodes each dial's role to its action UUID (`option-dial` = Claude,
 *   `iterm-dial` = Codex), so it can't be repointed. The remaining Claude
 *   gauge covers every window on its own — rotating cycles both → 5h → 7d →
 *   session.
 * - The Launcher dial went the way of the old launch keys: not reached for.
 * - A generic media-transport dial (`actionIdx: 22` on the same built-in
 *   `system.multimedia` action as `SYSTEM_VOLUME`) doesn't reach Focus@Will.
 *   Confirmed two ways: sending `pause` via the `nowplaying-cli` CLI tool is a
 *   no-op (elapsed time keeps climbing right through it), and clicking Pause
 *   on Focus@Will's own card in macOS Control Center does nothing either. The
 *   command genuinely doesn't work, on any sender — this isn't the
 *   `actionIdx` guess landing on the wrong built-in mode. Root cause:
 *   Focus@Will's Chromium layer registers itself as macOS's Now Playing app
 *   (hence live title/artist/elapsed time), but never wires up a working
 *   play/pause command handler, so every press — hardware key, Control
 *   Center, or this dial — gets swallowed by that broken registration before
 *   it can reach the app's own `globalShortcut.register("MediaPlayPause", …)`
 *   listener, which is what would have actually worked. This is a Focus@Will
 *   bug, not fixable from the Stream Deck side.
 * - D2 held AI Usage Limits' quota gauge for a while, as a second readout that
 *   didn't depend on the AgentDeck daemon. It was a duplicate in the end: both
 *   it and D1 show the *signed-in* account's quota and nothing else, so the
 *   two dials answered the same question twice. It's now the `cswap` dial,
 *   which answers the question D1 can't — how much is left on *each* account,
 *   which one is active, and switch between them — while still standing in as
 *   the daemon-independent readout, since it shells out to a CLI rather than
 *   talking to AgentDeck.
 */
const DIAL_STRIP: (Binding | null)[] = [
  {
    kind: "plugin",
    plugin: AGENTDECK,
    action: "bound.serendipity.agentdeck.option-dial",
    name: "Claude Usage",
  },
  {
    kind: "plugin",
    plugin: CSWAP,
    action: "com.dmoraes.cswap.accounts",
    name: "Accounts",
    settings: {
      refreshSeconds: 60,
      // The plugin would otherwise derive these from each email's domain —
      // accurate, but not what either account is called in your head.
      //
      // Keyed by cswap slot number rather than by email, which the plugin also
      // accepts: this repo is public, and renaming a bar shouldn't mean
      // publishing an address. The trade is that reordering accounts in cswap
      // would swap the labels. Anything unlisted still falls back to the
      // derived name, so a third account reads sensibly with no edit here.
      labels: { "1": "personal", "2": "work" },
    },
  },
  null,
  SYSTEM_VOLUME,
]

/**
 * Page 1 — Agents. Live Claude Code sessions, the way AgentDeck lays them out.
 *
 * AgentDeck's own recommended Stream Deck + profile is a wall of session slots
 * and nothing else. This is that, one slot short: K8 has to advance the page to
 * keep the three-page cycle closed.
 *
 * Nothing here *starts* an agent — Claude Code gets launched from a terminal,
 * so the old summon keys were dead weight.
 */
const AGENTS: Page = {
  title: "Agents",
  keys: [
    ...Array.from({ length: 7 }, () => SESSION_SLOT),
    { kind: "nextPage", title: "Work ▶" },
  ],
  dials: DIAL_STRIP,
}

/**
 * Page 2 — Work dashboard. Read-mostly status; pressing opens the relevant app.
 *
 * Dials are the shared strip, so Claude quota and system volume stay
 * glanceable and reachable from every page.
 */
const WORK: Page = {
  title: "Work",
  keys: [
    {
      kind: "plugin",
      plugin: GITHUB_STATS,
      action: "com.dmoraes.github-stats.search-count",
      name: "Search Count",
      settings: {
        query: "is:open is:pr review-requested:@me",
        warnAt: 1,
        openUrl: "https://github.com/pulls/review-requested",
      },
    },
    {
      kind: "plugin",
      plugin: GITHUB_STATS,
      action: "com.dmoraes.github-stats.search-count",
      name: "Search Count",
      settings: {
        query: "is:open is:pr author:@me",
        warnAt: 1,
        openUrl: "https://github.com/pulls",
      },
    },
    {
      kind: "plugin",
      plugin: GITHUB_STATS,
      action: "com.dmoraes.github-stats.ci-status",
      name: "CI Status",
      settings: { repo: "danielmoraes/dotfiles", branch: "main" },
    },
    {
      kind: "plugin",
      plugin: JIRA,
      action: "com.dmoraes.jira.jql-count",
      name: "JQL Count",
      settings: {
        jql: "assignee = currentUser() AND statusCategory != Done",
        warnAt: 1,
      },
    },
    {
      kind: "plugin",
      plugin: SLACK_UNREAD,
      action: "com.dmoraes.slack-unread.unread-count",
      name: "Unread Count",
      settings: { warnAt: 1, refreshSeconds: 60 },
    },
    {
      kind: "plugin",
      plugin: CALENDAR,
      action: "com.dmoraes.calendar.next-meeting",
      name: "Next Meeting",
      settings: { warnMinutes: 10, refreshSeconds: 60 },
    },
    {
      kind: "plugin",
      plugin: SLACK_UNREAD,
      action: "com.dmoraes.slack-unread.status",
      name: "Slack Status",
      settings: { refreshSeconds: 60 },
    },
    { kind: "nextPage", title: "Modes ▶" },
  ],
  dials: DIAL_STRIP,
}

/**
 * Page 3 — Modes, media & metrics.
 *
 * K5/K6 are still Spotify-specific — they're unrelated to today's dial
 * change, but worth a look if Spotify isn't the daily driver here either.
 */
const MODES: Page = {
  title: "Modes",
  keys: [
    run("sd-focus-mode", "Focus"),
    run("sd-meeting-mode", "Meeting"),
    run("sd-quick-capture", "Capture"),
    {
      kind: "plugin",
      plugin: WEEKLY_METRICS,
      action: "com.dmoraes.weekly-metrics.metric",
      name: "Weekly Metric",
      settings: { cycle: ["coding", "prs-merged", "meetings"] },
    },
    {
      kind: "plugin",
      plugin: SPOTIFY,
      action: "com.ntanis.essentials-for-spotify.play-pause-button",
      name: "Play / Pause",
    },
    {
      kind: "plugin",
      plugin: SPOTIFY,
      action: "com.ntanis.essentials-for-spotify.next-song-button",
      name: "Next Song",
    },
    run("sd-standup", "Standup"),
    { kind: "nextPage", title: "Agents ▶" },
  ],
  dials: DIAL_STRIP,
}

/** The profile written to the deck. Page order is the K8 cycle order. */
export const PROFILE_NAME = "Dotfiles"
export const PAGES: readonly Page[] = [AGENTS, WORK, MODES]

/** Stream Deck + hardware: 4 columns x 2 rows of keys, plus 4 encoders. */
export const COLUMNS = 4
export const ROWS = 2
export const DIALS = 4
