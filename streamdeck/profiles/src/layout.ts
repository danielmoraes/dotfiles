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
const AI_LIMITS: PluginRef = {
  name: "AI Usage Limits",
  uuid: "com.len.limits",
  version: "0.1.19.0",
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

/** A key or dial binding. */
export type Binding =
  /** Run one of the repo's `sd-*` commands via the `commands` plugin. */
  | { kind: "run"; command: string; args?: string[]; title: string }
  /** Open a URL in the browser. */
  | { kind: "website"; url: string; title: string }
  /** Advance to the next page of this profile. */
  | { kind: "nextPage"; title: string }
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
 * Page 1 — Agents. Driving Claude Code / Codex / pi and switching context.
 *
 * The dials are AgentDeck's: live Claude and Codex quota on the LCD strip,
 * system volume, and a session launcher.
 */
const AGENTS: Page = {
  title: "Agents",
  keys: [
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.session-slot",
      name: "Session Slot",
    },
    run("sd-summon-agent", "Claude", "claude"),
    run("sd-summon-agent", "Codex", "codex"),
    run("sd-summon-agent", "pi", "pi"),
    run("sd-switch-claude-account", "Account"),
    run("sd-summon-claude", "Summon"),
    {
      kind: "plugin",
      plugin: AI_LIMITS,
      action: "com.len.limits.progress",
      name: "Progress Bars (Claude)",
    },
    { kind: "nextPage", title: "Work ▶" },
  ],
  dials: [
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.option-dial",
      name: "Claude Usage",
    },
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.iterm-dial",
      name: "Codex Usage",
    },
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.utility-dial",
      name: "Volume",
    },
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.launcher",
      name: "Launcher",
    },
  ],
}

/**
 * Page 2 — Work dashboard. Read-mostly status; pressing opens the relevant app.
 *
 * Dials stay on AgentDeck so quota is glanceable from both working pages.
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
    run("sd-slack-status", "Status"),
    { kind: "nextPage", title: "Modes ▶" },
  ],
  dials: AGENTS.dials,
}

/** Page 3 — Modes, media & metrics. Dials hand over to Spotify here. */
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
  dials: [
    {
      kind: "plugin",
      plugin: SPOTIFY,
      action: "com.ntanis.essentials-for-spotify.playback-control-dial",
      name: "Playback Control",
    },
    {
      kind: "plugin",
      plugin: SPOTIFY,
      action: "com.ntanis.essentials-for-spotify.volume-control-dial",
      name: "Volume Control",
    },
    {
      kind: "plugin",
      plugin: SPOTIFY,
      action: "com.ntanis.essentials-for-spotify.my-playlists-dial",
      name: "My Playlists",
    },
    {
      kind: "plugin",
      plugin: AGENTDECK,
      action: "bound.serendipity.agentdeck.utility-dial",
      name: "Volume",
    },
  ],
}

/** The profile written to the deck. Page order is the K8 cycle order. */
export const PROFILE_NAME = "Dotfiles"
export const PAGES: readonly Page[] = [AGENTS, WORK, MODES]

/** Stream Deck + hardware: 4 columns x 2 rows of keys, plus 4 encoders. */
export const COLUMNS = 4
export const ROWS = 2
export const DIALS = 4
