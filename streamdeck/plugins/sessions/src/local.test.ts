import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { isAlive, nameOf, parseSession, Sessions } from "./local"

/** A record shaped like the ones Claude Code writes. */
function record(fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    pid: process.pid,
    sessionId: "95fc184c-8556-4e57-8bab-5f70849072f8",
    cwd: "/w/repo/.claude/worktrees/slug",
    startedAt: 1785784996705,
    version: "2.1.220",
    kind: "interactive",
    status: "busy",
    ...fields,
  })
}

test("a record parses into what a key needs", () => {
  expect(parseSession(record({ name: "stream deck" }))).toEqual({
    pid: process.pid,
    sessionId: "95fc184c-8556-4e57-8bab-5f70849072f8",
    cwd: "/w/repo/.claude/worktrees/slug",
    startedAt: 1785784996705,
    name: "stream deck",
    status: "busy",
  })
})

test("a record that isn't one costs its own session, nothing else", () => {
  expect(parseSession("not json")).toBeUndefined()
  expect(parseSession("null")).toBeUndefined()
  expect(parseSession(JSON.stringify({ pid: 1 }))).toBeUndefined()
  expect(parseSession(JSON.stringify({ sessionId: "s" }))).toBeUndefined()
})

test("a generated name is dropped — the key already shows the worktree", () => {
  expect(nameOf({ name: "stream deck" })).toBe("stream deck")
  expect(
    nameOf({ name: "graceful-wibbling-dewdrop-0d", nameSource: "derived" }),
  ).toBeUndefined()
  expect(nameOf({ name: "" })).toBeUndefined()
  expect(nameOf({})).toBeUndefined()
})

test("liveness is checked, so a crashed session's record doesn't linger", () => {
  expect(isAlive(process.pid)).toBe(true)
  // Nothing runs at pid 0x7FFFFFFF; the record would otherwise claim a key.
  expect(isAlive(2_147_483_647)).toBe(false)
})

test("the listed set is in deck order, not the order the directory gave it", () => {
  const dir = mkdtempSync(join(tmpdir(), "sessions-"))
  try {
    // Written newest-first, so passing this can't be the old oldest-first sort
    // or the filesystem's own ordering surviving by luck.
    writeFileSync(
      join(dir, "1.json"),
      record({ sessionId: "c", cwd: "/w/steward", startedAt: 300 }),
    )
    writeFileSync(
      join(dir, "2.json"),
      record({ sessionId: "a", cwd: "/w/dotfiles", startedAt: 200 }),
    )
    writeFileSync(
      join(dir, "3.json"),
      record({ sessionId: "b", cwd: "/w/assets", startedAt: 100 }),
    )
    const sessions = new Sessions(dir)
    expect(sessions.list(0).map((s) => s.sessionId)).toEqual(["b", "a", "c"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("dead sessions and unreadable files are skipped", () => {
  const dir = mkdtempSync(join(tmpdir(), "sessions-"))
  try {
    writeFileSync(join(dir, "live.json"), record({ sessionId: "live" }))
    writeFileSync(
      join(dir, "dead.json"),
      record({ sessionId: "dead", pid: 2_147_483_647 }),
    )
    writeFileSync(join(dir, "broken.json"), "{{{")
    writeFileSync(join(dir, "notes.txt"), "ignored")
    const sessions = new Sessions(dir)
    expect(sessions.list(0).map((s) => s.sessionId)).toEqual(["live"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a missing directory means no sessions, not a crash", () => {
  const sessions = new Sessions(join(tmpdir(), "definitely-not-here-99999"))
  expect(sessions.list(0)).toEqual([])
})

test("reads are cached, then picked up again after the TTL", () => {
  const dir = mkdtempSync(join(tmpdir(), "sessions-"))
  try {
    const sessions = new Sessions(dir)
    expect(sessions.list(0)).toEqual([])

    writeFileSync(join(dir, "1.json"), record({ sessionId: "new" }))
    // Inside the TTL the new session isn't visible yet — that's the trade for
    // not rescanning the directory ten times a second.
    expect(sessions.list(500)).toEqual([])
    expect(sessions.list(2_000).map((s) => s.sessionId)).toEqual(["new"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
