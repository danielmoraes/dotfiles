import { expect, test } from "vite-plus/test"
import {
  type ReadFile,
  countState,
  formatTitle,
  parseUnread,
  selectCount,
  unreadCounts,
} from "./slack"

/**
 * The shape Slack's desktop app actually persists, trimmed to the keys we read.
 * Captured from a real `~/Library/Application Support/Slack/storage/root-state.json`.
 */
const STATE = JSON.stringify({
  settings: { irrelevant: true },
  webapp: {
    teams: {
      T4BB7S7HP: {
        unreads: { unreads: 0, unreadHighlights: 0, showBullet: false },
      },
      T8TM982US: {
        unreads: { unreads: 3, unreadHighlights: 1, showBullet: true },
      },
      T01GCL1ER2N: {
        unreads: { unreads: 2, unreadHighlights: 0, showBullet: true },
      },
    },
  },
})

test("parseUnread sums the badge across workspaces", () => {
  expect(parseUnread(STATE)).toEqual({
    unreads: 5,
    highlights: 1,
    bullet: true,
    workspaces: 3,
  })
})

test("parseUnread can restrict to specific workspaces", () => {
  expect(parseUnread(STATE, ["T8TM982US"])).toEqual({
    unreads: 3,
    highlights: 1,
    bullet: true,
    workspaces: 1,
  })
  // A workspace with nothing unread contributes no bullet.
  expect(parseUnread(STATE, ["T4BB7S7HP"]).bullet).toBe(false)
})

test("parseUnread tolerates missing or malformed workspace entries", () => {
  const messy = JSON.stringify({
    webapp: {
      teams: {
        GOOD: { unreads: { unreads: 4 } },
        NO_UNREADS: { something: 1 },
        NOT_AN_OBJECT: "nope",
      },
    },
  })
  expect(parseUnread(messy)).toEqual({
    unreads: 4,
    highlights: 0,
    bullet: false,
    workspaces: 1,
  })
})

test("parseUnread rejects a file it can't make sense of", () => {
  // Failing loudly matters: a Slack update reshaping this file must surface as
  // an error on the key, never as a confident zero.
  expect(() => parseUnread("not json")).toThrow(/not valid JSON/)
  expect(() => parseUnread("{}")).toThrow(/unexpected shape/)
  expect(() => parseUnread('{"webapp":{}}')).toThrow(/no workspaces/)
  expect(() => parseUnread('{"webapp":{"teams":{}}}')).toThrow(
    /no readable workspaces/,
  )
})

test("unreadCounts reads the state file from the given path", () => {
  const seen: string[] = []
  const readFileImpl: ReadFile = (path) => {
    seen.push(path)
    return STATE
  }
  expect(unreadCounts({ path: "/tmp/state.json", readFileImpl }).unreads).toBe(
    5,
  )
  expect(seen).toEqual(["/tmp/state.json"])
})

test("unreadCounts reports a missing file rather than returning zero", () => {
  const readFileImpl: ReadFile = () => {
    throw new Error("ENOENT")
  }
  expect(() => unreadCounts({ path: "/nope.json", readFileImpl })).toThrow(
    /not found at \/nope\.json/,
  )
})

test("selectCount switches between the badge and mentions only", () => {
  const unread = { unreads: 5, highlights: 1, bullet: true, workspaces: 3 }
  expect(selectCount(unread)).toBe(5)
  expect(selectCount(unread, "all")).toBe(5)
  expect(selectCount(unread, "highlights")).toBe(1)
})

test("formatTitle is always a plain count, never a glyph", () => {
  expect(
    formatTitle({ unreads: 5, highlights: 1, bullet: true, workspaces: 1 }),
  ).toBe("5")
  // Unread channel activity with no badge reads as 0 — a bullet here had to be
  // explained to be understood, so the key states only what it can state.
  expect(
    formatTitle({ unreads: 0, highlights: 0, bullet: true, workspaces: 1 }),
  ).toBe("0")
  expect(
    formatTitle({ unreads: 0, highlights: 0, bullet: false, workspaces: 1 }),
  ).toBe("0")
  expect(
    formatTitle(
      { unreads: 5, highlights: 0, bullet: true, workspaces: 1 },
      "highlights",
    ),
  ).toBe("0")
})

test("countState flips at the threshold", () => {
  expect(countState(0)).toBe(0)
  expect(countState(1)).toBe(1)
  expect(countState(5, 3)).toBe(1)
  expect(countState(2, 3)).toBe(0)
})
