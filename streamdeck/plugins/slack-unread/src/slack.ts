import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Read Slack's unread badge from the desktop app's own persisted state.
 *
 * The obvious approach — `users.counts` — is closed: it returns
 * `not_allowed_token_type` for modern `xoxp-` tokens, and the legacy `client`
 * scope it wants can't be granted to apps created today. The public
 * `conversations.*` methods have no unread concept; reconstructing one means a
 * `last_read` lookup plus a history scan per conversation, which is hundreds of
 * calls against a 50/min tier.
 *
 * The Slack desktop app already computes exactly the number we want for its own
 * dock badge and persists it to a plain JSON file. Reading that costs nothing,
 * needs no token, no network, and no macOS privacy grant.
 *
 * The trade: it's an undocumented file that a Slack update could reshape, and
 * it only reflects reality while the desktop app is running. Both fail soft —
 * the key shows a dash rather than a wrong number.
 */

export const SLACK_STATE_PATH = join(
  homedir(),
  "Library",
  "Application Support",
  "Slack",
  "storage",
  "root-state.json",
)

/** Unread work, as Slack itself counts it. */
export type Unread = {
  /** Badge number: DMs plus mentions, summed across workspaces. */
  unreads: number
  /** The mention/highlight subset of `unreads`. */
  highlights: number
  /** Any workspace has unread channel activity that doesn't earn a badge. */
  bullet: boolean
  /** How many workspaces were found — 0 means the file wasn't usable. */
  workspaces: number
}

/** How the state file is read; injectable so parsing is testable. */
export type ReadFile = (path: string) => string

const readFile: ReadFile = (path) => readFileSync(path, "utf8")

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function num(source: unknown, key: string): number {
  if (!isRecord(source)) {
    return 0
  }
  const value = source[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export type UnreadOptions = {
  /** Override the state file location (testing). */
  path?: string
  /** Restrict to these workspace/team ids; all workspaces when omitted. */
  teams?: readonly string[]
  readFileImpl?: ReadFile
}

/**
 * Parse the desktop app's state.
 *
 * Shape: `webapp.teams.<TEAM_ID>.unreads = { unreads, unreadHighlights,
 * showBullet }`, one entry per signed-in workspace.
 */
export function parseUnread(
  contents: string,
  teams?: readonly string[],
): Unread {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error("Slack state file is not valid JSON")
  }
  if (!isRecord(parsed) || !isRecord(parsed.webapp)) {
    throw new Error("Slack state file has an unexpected shape")
  }
  const byTeam = parsed.webapp.teams
  if (!isRecord(byTeam)) {
    throw new Error("Slack state file has no workspaces")
  }

  let unreads = 0
  let highlights = 0
  let bullet = false
  let workspaces = 0
  for (const [id, team] of Object.entries(byTeam)) {
    if (teams && teams.length > 0 && !teams.includes(id)) {
      continue
    }
    if (!isRecord(team) || !isRecord(team.unreads)) {
      continue
    }
    workspaces++
    unreads += num(team.unreads, "unreads")
    highlights += num(team.unreads, "unreadHighlights")
    bullet = bullet || team.unreads.showBullet === true
  }
  if (workspaces === 0) {
    throw new Error("Slack state file listed no readable workspaces")
  }
  return { unreads, highlights, bullet, workspaces }
}

/** Read and parse the desktop app's unread state. */
export function unreadCounts(opts: UnreadOptions = {}): Unread {
  const path = opts.path ?? SLACK_STATE_PATH
  const read = opts.readFileImpl ?? readFile
  let contents: string
  try {
    contents = read(path)
  } catch {
    throw new Error(`Slack state file not found at ${path}`)
  }
  return parseUnread(contents, opts.teams)
}

/** Which part of `Unread` a key should show. */
export type UnreadMode = "all" | "highlights"

/**
 * The number for the key.
 *
 * `all` is the badge Slack itself shows; `highlights` narrows to mentions.
 */
export function selectCount(unread: Unread, mode: UnreadMode = "all"): number {
  return mode === "highlights" ? unread.highlights : unread.unreads
}

/**
 * Key title: always the count.
 *
 * An earlier version showed `•` for unread channel activity carrying no badge,
 * mirroring Slack's sidebar. At key size that read as a smudge and had to be
 * explained to be understood, which is the definition of a failed glyph — so
 * the key shows only what it can state plainly. `bullet` is still parsed and
 * available on `Unread` for anything that wants it.
 */
export function formatTitle(unread: Unread, mode: UnreadMode = "all"): string {
  return String(selectCount(unread, mode))
}

/** Two-state key helper: 0 = quiet, 1 = attention (count at/above threshold). */
export function countState(n: number, warnAt = 1): 0 | 1 {
  return n >= warnAt ? 1 : 0
}
