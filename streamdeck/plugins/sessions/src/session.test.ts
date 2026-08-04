import { expect, test } from "vite-plus/test"
import type { LocalSession } from "./local"
import {
  elapsedLabel,
  headingOf,
  order,
  repoOf,
  slotState,
  startedLabel,
  toSlot,
} from "./session"

const AT_16_06 = new Date(2026, 7, 3, 16, 6, 0).getTime()

test("a worktree checkout names the repo, not the slug", () => {
  expect(
    repoOf(
      "/Users/moraes/Work/devord/steward/.claude/worktrees/calm-mapping-twilight",
    ),
  ).toEqual({ repo: "steward", worktree: "calm-mapping-twilight" })
})

test("an ordinary checkout has no worktree line", () => {
  expect(repoOf("/Users/moraes/Work/devord/steward")).toEqual({
    repo: "steward",
  })
  expect(repoOf("/Users/moraes/Work/devord/steward/")).toEqual({
    repo: "steward",
  })
})

test("an unknown cwd still renders something", () => {
  expect(repoOf(undefined)).toEqual({ repo: "?" })
})

test("Claude Code's status words map onto the three border states", () => {
  expect(slotState("busy")).toBe("running")
  expect(slotState("waiting")).toBe("awaiting")
  expect(slotState("idle")).toBe("idle")
  // An unrecognised status reads as idle: the quietest reading is the safest
  // one to be wrong with, since amber means "drop what you're doing".
  expect(slotState("something-new")).toBe("idle")
  expect(slotState(undefined)).toBe("idle")
})

test("elapsed picks the unit that fits the key", () => {
  expect(elapsedLabel(45)).toBe("45s")
  expect(elapsedLabel(60)).toBe("1m")
  expect(elapsedLabel(21 * 60)).toBe("21m")
  expect(elapsedLabel(72 * 60)).toBe("1h12m")
  expect(elapsedLabel(undefined)).toBeUndefined()
  expect(elapsedLabel(Number.NaN)).toBeUndefined()
})

test("a start time that isn't one is dropped, not drawn", () => {
  expect(startedLabel(undefined)).toBeUndefined()
  expect(startedLabel(Number.NaN)).toBeUndefined()
  expect(startedLabel(AT_16_06)).toBe("16:06")
})

test("elapsed climbs from startedAt, so it moves between reads", () => {
  const session: LocalSession = {
    pid: 1,
    sessionId: "s",
    startedAt: AT_16_06,
  }
  expect(toSlot(session, AT_16_06 + 21 * 60_000).elapsedSec).toBe(21 * 60)
})

test("a session with no start time simply has no clock", () => {
  const slot = toSlot({ pid: 1, sessionId: "s" }, Date.now())
  expect(slot.elapsedSec).toBeUndefined()
  expect(slot.startedAt).toBeUndefined()
})

test("the name and the state come off the record itself", () => {
  const slot = toSlot(
    {
      pid: 1,
      sessionId: "s",
      cwd: "/w/repo/.claude/worktrees/slug",
      name: "stream deck",
      status: "waiting",
    },
    0,
  )
  expect(slot.repo).toBe("repo")
  expect(slot.worktree).toBe("slug")
  expect(slot.name).toBe("stream deck")
  expect(slot.state).toBe("awaiting")
})

test("context is passed in, not read from the record", () => {
  const slot = toSlot({ pid: 1, sessionId: "s" }, 0, { contextPercent: 28.1 })
  expect(slot.contextPercent).toBe(28.1)
})

test("the heading is the best distinguisher, not the best name", () => {
  const repo = "steward"
  expect(headingOf({ repo, name: "stream deck", worktree: "slug" })).toBe(
    "stream deck",
  )
  // No name: the slug says which of several checkouts of one repo this is.
  expect(headingOf({ repo, worktree: "slug" })).toBe("slug")
  // Nothing to distinguish — the repo is the whole answer.
  expect(headingOf({ repo })).toBe("steward")
})

/** A record with just the fields the order depends on. */
function at(sessionId: string, cwd: string, name?: string) {
  return { pid: 1, sessionId, cwd, name }
}

test("sessions group by repo, then sort by the line their key leads with", () => {
  const sessions = order([
    at("1", "/w/steward/.claude/worktrees/zebra"),
    at("2", "/w/dotfiles", "stream deck"),
    at("3", "/w/steward", "auth fix"),
    at("4", "/w/steward/.claude/worktrees/alpha"),
  ])
  // dotfiles before steward; then within steward, `alpha` / `auth fix` / `zebra`
  // — the headings, whether they came from a slug or a name.
  expect(sessions.map((s) => s.sessionId)).toEqual(["2", "4", "3", "1"])
})

test("case doesn't jump a key to the front, and 10 follows 2", () => {
  const sessions = order([
    at("1", "/w/repo-10"),
    at("2", "/w/Repo-2"),
    at("3", "/w/repo-1"),
  ])
  expect(sessions.map((s) => s.sessionId)).toEqual(["3", "2", "1"])
})

test("the order is total, so equal keys can't swap between repaints", () => {
  // Same repo, same heading: only the session id is left to separate them, and
  // it has to, or two keys would trade places on every read.
  const forward = order([at("b", "/w/repo"), at("a", "/w/repo")])
  const backward = order([at("a", "/w/repo"), at("b", "/w/repo")])
  expect(forward.map((s) => s.sessionId)).toEqual(["a", "b"])
  expect(backward.map((s) => s.sessionId)).toEqual(["a", "b"])
})

test("a session with no cwd sorts somewhere fixed instead of moving", () => {
  const sessions = order([at("1", "/w/repo"), { pid: 1, sessionId: "2" }])
  // `?` is what repoOf calls an unknown cwd; it just has to sort consistently.
  expect(sessions.map((s) => s.sessionId)).toEqual(["2", "1"])
})
