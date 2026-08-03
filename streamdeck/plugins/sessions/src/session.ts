/**
 * The smaller thing a key needs, derived from a live session record.
 *
 * Everything here is pure — a record in, a `Slot` out — so what the key says
 * can be tested without a filesystem, a deck, or a running agent.
 */

import type { LocalSession } from "./local"

/** What the border colour says, and nothing more. */
export type SlotState = "running" | "awaiting" | "idle"

/** The key's whole vocabulary. */
export type Slot = {
  /** Repository name — the identity you actually think in. */
  repo: string
  /**
   * The session's own name, when you gave it one with `/rename`. Takes the
   * worktree's line, because a name you chose beats a slug you didn't.
   */
  name?: string
  /** Worktree slug, when the session is in one. */
  worktree?: string
  state: SlotState
  /** Context window used; can exceed 100 once compaction is in play. */
  contextPercent?: number
  /** Wall-clock since the session started. */
  elapsedSec?: number
  /** Local `HH:MM` the session started at. */
  startedAt?: string
  /** Short terminal name, e.g. `s002`. */
  terminal?: string
}

/** Trailing path segment that marks a Claude Code worktree checkout. */
const WORKTREE_MARKER = "/.claude/worktrees/"

/**
 * Split a working directory into the repo and, if it is one, the worktree.
 *
 * The basename can't do this job: for a worktree it's the slug, so three
 * worktrees of the same repo read as three unrelated names and the key showing
 * them is useless when you're in several at once. (That basename is exactly
 * what AgentDeck's slot showed, and the reason this plugin exists.)
 *
 * Only the `.claude/worktrees/<slug>` convention is recognised — a git worktree
 * placed anywhere else is indistinguishable from an ordinary checkout without
 * shelling out to git, which is not worth a subprocess per session per repaint.
 */
export function repoOf(cwd: string | undefined): {
  repo: string
  worktree?: string
} {
  if (!cwd) {
    return { repo: "?" }
  }
  const marker = cwd.indexOf(WORKTREE_MARKER)
  if (marker === -1) {
    return { repo: basename(cwd) }
  }
  const root = cwd.slice(0, marker)
  const slug = cwd.slice(marker + WORKTREE_MARKER.length).split("/")[0]
  return {
    repo: basename(root),
    worktree: slug === undefined || slug === "" ? undefined : slug,
  }
}

function basename(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || trimmed || "?"
}

/**
 * Collapse Claude Code's status into the three the border can show.
 *
 * `busy` is a turn in flight; `waiting` is any of the several ways a session
 * can want you — a permission prompt, a choice, a question — which all mean
 * the same thing to someone glancing at a deck. Anything else, including a
 * status this doesn't recognise, is idle: the quietest reading is the safest
 * one to be wrong with.
 */
export function slotState(status: string | undefined): SlotState {
  if (status === "busy") {
    return "running"
  }
  if (status === "waiting") {
    return "awaiting"
  }
  return "idle"
}

/** `21m`, `1h12m`, `45s` — whichever unit still fits the key. */
export function elapsedLabel(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return undefined
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`
}

/** Local wall-clock, because "started at 16:06" is how you remember it. */
export function startedLabel(
  startedAt: number | undefined,
): string | undefined {
  if (startedAt === undefined || !Number.isFinite(startedAt)) {
    return undefined
  }
  const date = new Date(startedAt)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

/** Extras that don't come from the session record itself. */
export type Extras = {
  /** Percentage of the context window used; see `context.ts`. */
  contextPercent?: number
  /** Short terminal name; see `local.terminalOf`. */
  terminal?: string
}

export function toSlot(
  session: LocalSession,
  now: number,
  extras: Extras = {},
): Slot {
  const { repo, worktree } = repoOf(session.cwd)
  return {
    repo,
    name: session.name,
    worktree,
    terminal: extras.terminal,
    state: slotState(session.status),
    contextPercent: extras.contextPercent,
    elapsedSec:
      session.startedAt === undefined
        ? undefined
        : Math.max(0, (now - session.startedAt) / 1000),
    startedAt: startedLabel(session.startedAt),
  }
}
