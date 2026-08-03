/**
 * How full a session's context window is, counted from its own transcript.
 *
 * **Not** the daemon's `contextPercent`. That field divides by a hardcoded
 * 200 000, so on a 1M-context model it reads five times high — a session
 * genuinely at 28% arrives as `140.3%`. The numerator is fine and the
 * denominator is someone else's assumption, so neither is used: the tokens are
 * read from the transcript and divided by a window this plugin is told.
 *
 * The count matches what Claude Code's own status line shows, because it's the
 * same arithmetic on the same numbers — `input + cache_creation + cache_read`
 * of the most recent assistant message, which is the whole prompt that message
 * was produced from.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Claude Code's own fallback when it isn't told a window
 * (`.context_window.context_window_size // 200000`), so it's ours too. Sessions
 * on a larger model need `contextWindow` set — see the action's settings.
 */
export const DEFAULT_WINDOW = 200_000

/** Re-read no more often than this; the count only moves once per turn. */
const TTL_MS = 5_000

/**
 * How much of the transcript's tail to read.
 *
 * Transcripts run to megabytes, and everything needed is in the last assistant
 * message — so this reads backwards from the end rather than parsing the file.
 * 256KB comfortably covers several turns even when tool results are large.
 */
const TAIL_BYTES = 256 * 1024

export function projectsDir(): string {
  return join(homedir(), ".claude", "projects")
}

/**
 * Claude Code's directory name for a working directory.
 *
 * Every path separator and dot becomes a dash, so
 * `/Users/me/repo/.claude/worktrees/x` is `-Users-me-repo--claude-worktrees-x`.
 * A guess, not a contract — hence the scan `transcriptPath` falls back to.
 */
export function encodeCwd(cwd: string): string {
  return cwd.replaceAll(/[/.]/g, "-")
}

/**
 * Locate a session's transcript.
 *
 * Tries the encoded directory first, then scans, because the encoding is
 * inferred from observation and a session whose transcript can't be found
 * should lose its bar rather than take the key down.
 */
export function transcriptPath(
  sessionId: string,
  cwd: string | undefined,
  root: string = projectsDir(),
): string | undefined {
  const file = `${sessionId}.jsonl`
  if (cwd !== undefined) {
    const guess = join(root, encodeCwd(cwd), file)
    if (existsSync(guess)) {
      return guess
    }
  }
  let dirs: string[]
  try {
    dirs = readdirSync(root)
  } catch {
    return undefined
  }
  for (const dir of dirs) {
    const candidate = join(root, dir, file)
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

/** Read the last `TAIL_BYTES` of a file, dropping any partial first line. */
function tail(path: string): string | undefined {
  let fd: number | undefined
  try {
    const size = statSync(path).size
    const length = Math.min(size, TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    fd = openSync(path, "r")
    readSync(fd, buffer, 0, length, size - length)
    const text = buffer.toString("utf8")
    // Unless we started at byte 0, the first line is a fragment of an earlier
    // one — JSON.parse would fail on it anyway, but dropping it is honest.
    return length === size ? text : text.slice(text.indexOf("\n") + 1)
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Tokens in the most recent assistant turn's prompt.
 *
 * Exported so the arithmetic can be tested against a real transcript shape
 * without a filesystem.
 */
export function tokensIn(transcriptTail: string): number | undefined {
  const lines = transcriptTail.split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line === undefined || line === "" || !line.includes('"usage"')) {
      continue
    }
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const usage = Object(Object(Object(entry)["message"])["usage"])
    const input = usage["input_tokens"]
    if (typeof input !== "number") {
      continue
    }
    const created = usage["cache_creation_input_tokens"]
    const read = usage["cache_read_input_tokens"]
    return (
      input +
      (typeof created === "number" ? created : 0) +
      (typeof read === "number" ? read : 0)
    )
  }
  return undefined
}

/** Per-session context usage, cached so repaints don't re-read transcripts. */
export class Context {
  private readonly paths = new Map<string, string | undefined>()
  private readonly cache = new Map<string, number | undefined>()
  private readAt = Number.NEGATIVE_INFINITY

  constructor(private readonly root: string = projectsDir()) {}

  /**
   * Percentage of `window` used, or undefined when the transcript can't be
   * read. Values above 100 are real and worth showing — that's compaction
   * territory — unlike the daemon's, which were an artifact of its denominator.
   */
  percent(
    sessionId: string,
    cwd: string | undefined,
    now: number,
    window: number = DEFAULT_WINDOW,
  ): number | undefined {
    if (now - this.readAt >= TTL_MS) {
      this.cache.clear()
      this.readAt = now
    }
    if (!this.cache.has(sessionId)) {
      this.cache.set(sessionId, this.read(sessionId, cwd))
    }
    const tokens = this.cache.get(sessionId)
    if (tokens === undefined || window <= 0) {
      return undefined
    }
    return (tokens / window) * 100
  }

  private read(sessionId: string, cwd: string | undefined): number | undefined {
    // The path is memoised for the process's life — a session's transcript
    // doesn't move, and the fallback scan crosses hundreds of directories.
    if (!this.paths.has(sessionId)) {
      this.paths.set(sessionId, transcriptPath(sessionId, cwd, this.root))
    }
    const path = this.paths.get(sessionId)
    if (path === undefined) {
      return undefined
    }
    const text = tail(path)
    return text === undefined ? undefined : tokensIn(text)
  }
}
