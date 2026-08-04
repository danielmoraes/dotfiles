/**
 * Live Claude Code sessions, read from Claude Code itself.
 *
 * Every running session keeps a record at `~/.claude/sessions/<pid>.json`:
 *
 * ```json
 * { "pid": 22112, "sessionId": "95fc184c-…", "cwd": "/Users/…/worktree",
 *   "startedAt": 1785784996705, "name": "stream deck", "status": "busy" }
 * ```
 *
 * That is the whole feed. An earlier version of this plugin read the AgentDeck
 * daemon instead, and got the same facts one process further from the truth —
 * its `contextPercent` divided by a hardcoded 200 000, so a session genuinely
 * at 28% arrived as 140%, and its `projectName` was the worktree slug rather
 * than the repo. Both had to be recomputed here anyway. What's left needs no
 * daemon at all, which means nothing on this deck can be taken out by one
 * being down — and AgentDeck's blocking `PreToolUse` hook, which every tool
 * call in every session waited on, isn't needed either.
 *
 * The one thing lost with it is answering a permission prompt from the deck:
 * that needs a hook holding the call open, which no file can provide.
 */

import { readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { order } from "./session"

/** How long a directory read is reused. */
const TTL_MS = 1_000

export type LocalSession = {
  pid: number
  sessionId: string
  cwd?: string
  /** Wall-clock ms when the session started. */
  startedAt?: number
  /** Only when it's a name someone chose; see `nameOf`. */
  name?: string
  /** Claude Code's own word: `busy`, `waiting`, or idle-ish. */
  status?: string
}

export function sessionsDir(): string {
  return join(homedir(), ".claude", "sessions")
}

/**
 * Parse one `<pid>.json`.
 *
 * Anything unexpected costs that one session, not the read — this is Claude
 * Code's shape, not ours, and it's free to change between versions.
 */
export function parseSession(raw: string): LocalSession | undefined {
  let record: unknown
  try {
    record = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof record !== "object" || record === null) {
    return undefined
  }
  const fields: Record<string, unknown> = Object(record)
  const pid = fields["pid"]
  const sessionId = fields["sessionId"]
  if (typeof pid !== "number" || typeof sessionId !== "string") {
    return undefined
  }
  const cwd = fields["cwd"]
  const startedAt = fields["startedAt"]
  const status = fields["status"]
  return {
    pid,
    sessionId,
    cwd: typeof cwd === "string" ? cwd : undefined,
    startedAt: typeof startedAt === "number" ? startedAt : undefined,
    name: nameOf(fields),
    status: typeof status === "string" ? status : undefined,
  }
}

/**
 * The session's name, if it's one you gave it.
 *
 * A session nobody has renamed carries a generated name plus
 * `"nameSource": "derived"` — `graceful-wibbling-dewdrop-0d`, the worktree slug
 * with two hex characters stuck on. That says nothing a key showing the
 * worktree doesn't, so only deliberate names survive.
 */
export function nameOf(fields: Record<string, unknown>): string | undefined {
  const name = fields["name"]
  if (typeof name !== "string" || name === "") {
    return undefined
  }
  return fields["nameSource"] === "derived" ? undefined : name
}

/**
 * Is the process still there?
 *
 * Signal 0 checks for existence without delivering anything. A record can
 * outlive its session if Claude Code is killed hard enough not to clean up,
 * and a key naming a session that ended an hour ago is worse than an empty
 * one.
 */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means it exists but belongs to someone else — still alive.
    return Object(error)["code"] === "EPERM"
  }
}

/**
 * The live session set, cached so repaints don't rescan.
 *
 * Ordered for the deck by `order`, which is where the reasoning for that order
 * lives — it sorts on what the keys print, so it belongs beside the code that
 * decides what they print.
 */
export class Sessions {
  private cache: LocalSession[] = []
  private readAt = Number.NEGATIVE_INFINITY

  constructor(private readonly dir: string = sessionsDir()) {}

  list(now: number): LocalSession[] {
    if (now - this.readAt >= TTL_MS) {
      this.cache = this.read()
      this.readAt = now
    }
    return this.cache
  }

  private read(): LocalSession[] {
    let entries: string[]
    try {
      entries = readdirSync(this.dir)
    } catch {
      // No directory means no sessions — an older Claude Code, or none running.
      return []
    }
    const found: LocalSession[] = []
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue
      }
      let raw: string
      try {
        raw = readFileSync(join(this.dir, entry), "utf8")
      } catch {
        // Racing a session that just exited; its record is simply gone.
        continue
      }
      const session = parseSession(raw)
      if (session && isAlive(session.pid)) {
        found.push(session)
      }
    }
    return order(found)
  }
}
