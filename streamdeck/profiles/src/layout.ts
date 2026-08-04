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
const CSWAP: PluginRef = {
  name: "Claude Accounts",
  uuid: "com.dmoraes.cswap",
  version: "0.1.0.0",
}
const SESSIONS: PluginRef = {
  name: "Claude Sessions",
  uuid: "com.dmoraes.sessions",
  version: "0.1.0.0",
}

/** A key or dial binding. */
export type Binding =
  /** Run one of the repo's `sd-*` commands via the `commands` plugin. */
  | { kind: "run"; command: string; args?: string[]; title: string }
  /** Open a URL in the browser. */
  | { kind: "website"; url: string; title: string }
  /**
   * Advance to the next page of this profile. `title` is the page it lands on,
   * bare — `page-key.ts` draws the arrow, so the label doesn't carry one.
   */
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
 * One live Claude Code session: which repo and worktree, how far through its
 * context window, and how long it has been running. A readout — pressing does
 * nothing.
 *
 * The slot each key shows is **positional** — the plugin sorts the keys by
 * their coordinates and fills them oldest session first, so the same binding
 * repeated across K1..K7 reads as sessions 0..6 and moving a key moves which
 * session it watches. No per-key settings, by design.
 *
 * Reads Claude Code's own files — `~/.claude/sessions/*.json` and each
 * session's transcript. No daemon, no hook, nothing to be down.
 *
 * This replaced AgentDeck's `session-slot`, which spent the key badly: a
 * quarter of it on a Claude watermark, the state said three times over
 * (border, badge pill, and the word `RUNNING`), and the one identity field
 * clipped to 13 characters of `projectName` — the basename of `cwd`, so every
 * worktree arrived as an unrelated slug and three sessions in the same repo
 * were indistinguishable. Its action carries no Property Inspector and no
 * settings, so none of that was tunable. Its daemon went the same way once it
 * turned out to be serving facts that were either already in `~/.claude/` or
 * wrong: `contextPercent` divides by a hardcoded 200 000, so a session at 28%
 * of a 1M window read as 140%. See `../plugins/sessions/README.md`.
 */
const SESSION_SLOT: Binding = {
  kind: "plugin",
  plugin: SESSIONS,
  action: "com.dmoraes.sessions.slot",
  name: "Session",
  settings: {
    // Claude Code never writes the real window anywhere — it hands
    // `context_window_size` to the status line on stdin and keeps no copy, and
    // the transcript records `claude-opus-5` for both the 200k and 1M variants.
    // So it's declared here. This deck runs the 1M model; the plugin falls back
    // to Claude Code's own 200 000 default when nothing is set.
    contextWindow: 1_000_000,
  },
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
 * should mean the same thing everywhere. Only two are bound: one Claude quota
 * readout and system volume. The rest are open, not filled for their own sake —
 * everything tried there has been pulled:
 *
 * - AgentDeck's Codex gauge is gone: only Claude runs here, and the plugin
 *   hardcodes each dial's role to its action UUID (`option-dial` = Claude,
 *   `iterm-dial` = Codex), so it can't be repointed.
 * - AgentDeck's Claude gauge (`option-dial`) followed it once `cswap` landed.
 *   It only ever showed the signed-in account, which `cswap` covers as one row
 *   of several — so keeping it meant two dials answering the same question.
 *   That took the AgentDeck daemon out of the dial strip; page 1's session keys
 *   later moved off it too, so nothing on the deck depends on it now.
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
 *
 * What's left on D1 is `cswap`, which answers what none of them could — how
 * much is left on *each* account, which one is active, and switching between
 * them — and needs no daemon, since it shells out to a CLI.
 */
const DIAL_STRIP: (Binding | null)[] = [
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
  // D2 and D3 both open. Volume stays on D4 rather than sliding left to close
  // the gap: it's the one dial with real muscle memory, and it sits under the
  // hand that reaches for it.
  null,
  null,
  SYSTEM_VOLUME,
]

/**
 * Page 1 — Agents. Every live Claude Code session at once.
 *
 * A wall of session slots and nothing else — the shape AgentDeck's own
 * recommended Stream Deck + profile uses, kept when its slot was replaced by
 * ours. One slot short of eight: K8 has to advance the page to keep the
 * three-page cycle closed.
 *
 * Nothing here *starts* an agent — Claude Code gets launched from a terminal,
 * so the old summon keys were dead weight.
 */
const AGENTS: Page = {
  title: "Agents",
  keys: [
    ...Array.from({ length: 7 }, () => SESSION_SLOT),
    { kind: "nextPage", title: "Work" },
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
    { kind: "nextPage", title: "Modes" },
  ],
  dials: DIAL_STRIP,
}

/**
 * Page 3 — Modes & metrics.
 *
 * K5/K6 are open. They held `essentials-for-spotify` transport keys, which went
 * when Spotify stopped being the player here. Nothing replaced them: the player
 * that took over is Focus@Will, and it ignores every generic media command —
 * see `DIAL_STRIP` for the two independent confirmations and the root cause. So
 * a media-transport key would be as dead as the dial was, and the slots stay
 * empty rather than filled for their own sake. Same rule as D2/D3.
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
    null,
    null,
    run("sd-standup", "Standup"),
    { kind: "nextPage", title: "Agents" },
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
