import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { Context, encodeCwd, tokensIn, transcriptPath } from "./context"

/** An assistant line shaped like the transcript's. */
function assistant(usage: Record<string, number>): string {
  return JSON.stringify({
    type: "assistant",
    message: { model: "claude-opus-5", role: "assistant", usage },
  })
}

const REAL_USAGE = {
  input_tokens: 2,
  cache_creation_input_tokens: 5,
  cache_read_input_tokens: 280_609,
  output_tokens: 406,
}

test("context is the whole prompt: input plus both cache figures", () => {
  // The numbers are a real reading from a session Claude Code showed as 28%.
  expect(tokensIn(assistant(REAL_USAGE))).toBe(280_616)
})

test("output tokens are not context — they're what the turn produced", () => {
  const tokens = tokensIn(assistant(REAL_USAGE))
  expect(tokens).not.toBe(280_616 + 406)
})

test("the most recent usage wins, not the largest or the first", () => {
  const tail = [
    assistant({ input_tokens: 999_999 }),
    assistant({ input_tokens: 10 }),
    JSON.stringify({ type: "user", message: { role: "user" } }),
  ].join("\n")
  expect(tokensIn(tail)).toBe(10)
})

test("a truncated first line is stepped over, not fatal", () => {
  const tail = ['ache_read_input_tokens":5}}', assistant(REAL_USAGE)].join("\n")
  expect(tokensIn(tail)).toBe(280_616)
})

test("a transcript with no usage yet has no reading", () => {
  expect(tokensIn("")).toBeUndefined()
  expect(tokensIn(JSON.stringify({ type: "user" }))).toBeUndefined()
  expect(tokensIn('{"message":{"usage":{}}}')).toBeUndefined()
})

test("the project directory name replaces separators and dots", () => {
  expect(
    encodeCwd("/Users/moraes/Work/personal/dotfiles/.claude/worktrees/lum"),
  ).toBe("-Users-moraes-Work-personal-dotfiles--claude-worktrees-lum")
})

/** A projects tree with one session's transcript in it. */
function fixture(usage: Record<string, number>): {
  root: string
  cwd: string
  sessionId: string
  cleanup: () => void
} {
  const root = mkdtempSync(join(tmpdir(), "projects-"))
  const cwd = "/Users/x/Work/repo/.claude/worktrees/slug"
  const sessionId = "95fc184c-8556-4e57-8bab-5f70849072f8"
  const dir = join(root, encodeCwd(cwd))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${assistant(usage)}\n`)
  return {
    root,
    cwd,
    sessionId,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

test("the transcript is found by the encoded path", () => {
  const { root, cwd, sessionId, cleanup } = fixture(REAL_USAGE)
  try {
    expect(transcriptPath(sessionId, cwd, root)).toContain(`${sessionId}.jsonl`)
  } finally {
    cleanup()
  }
})

test("a wrong cwd still finds it, because the encoding is a guess", () => {
  const { root, sessionId, cleanup } = fixture(REAL_USAGE)
  try {
    expect(transcriptPath(sessionId, "/somewhere/else", root)).toContain(
      `${sessionId}.jsonl`,
    )
    expect(transcriptPath("no-such-session", undefined, root)).toBeUndefined()
  } finally {
    cleanup()
  }
})

test("the percentage is of the window it's told, not a hardcoded one", () => {
  const { root, cwd, sessionId, cleanup } = fixture(REAL_USAGE)
  try {
    // 280 616 tokens. The daemon called this 140.3% by assuming 200k; against
    // the 1M window the session actually had, it's 28% — which is what Claude
    // Code's own status line showed at the time.
    const context = new Context(root)
    expect(context.percent(sessionId, cwd, 0, 1_000_000)).toBeCloseTo(28.06, 1)
    expect(context.percent(sessionId, cwd, 0, 200_000)).toBeCloseTo(140.3, 1)
  } finally {
    cleanup()
  }
})

test("an unreadable transcript costs the bar, not the key", () => {
  const context = new Context(join(tmpdir(), "definitely-not-here-99999"))
  expect(context.percent("any", "/x", 0, 1_000_000)).toBeUndefined()
})

test("a nonsense window is refused rather than dividing by zero", () => {
  const { root, cwd, sessionId, cleanup } = fixture(REAL_USAGE)
  try {
    const context = new Context(root)
    expect(context.percent(sessionId, cwd, 0, 0)).toBeUndefined()
  } finally {
    cleanup()
  }
})
