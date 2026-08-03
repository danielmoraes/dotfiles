import { expect, test } from "vite-plus/test"
import {
  type Runner,
  countMeetings,
  formatCountdown,
  isoDate,
  localEvents,
  minutesUntil,
  nextEvent,
  parseEvents,
  shortTitle,
} from "./index"

/** Real icalBuddy output shape: `DATE at HH:MM<TAB>TITLE`. */
const SAMPLE = [
  "2026-08-03 at 09:30\tStandup",
  "2026-08-03 at 12:00\tInternal Sync",
  "2026-08-04\tOOO",
  "2026-08-05 at 16:00\t1:1",
].join("\n")

test("parseEvents reads timed events into local Dates", () => {
  const events = parseEvents("2026-08-03 at 09:30\tStandup\n")
  expect(events).toHaveLength(1)
  expect(events[0]?.start).toEqual(new Date(2026, 7, 3, 9, 30))
  expect(events[0]?.allDay).toBe(false)
  expect(events[0]?.title).toBe("Standup")
})

test("parseEvents flags all-day entries (no time component)", () => {
  const events = parseEvents("2026-08-04\tOOO\n")
  expect(events[0]?.allDay).toBe(true)
  expect(events[0]?.start).toEqual(new Date(2026, 7, 4, 0, 0))
})

test("parseEvents keeps titles containing separators intact", () => {
  const events = parseEvents("2026-08-05 at 16:00\tCesar / Daniel — 1:1\n")
  expect(events[0]?.title).toBe("Cesar / Daniel — 1:1")
})

test("parseEvents skips blanks and unparseable continuation lines", () => {
  const events = parseEvents(
    "2026-08-03 at 09:30\tStandup\n\n       Join with Google Meet: https://x\nnot an event\n",
  )
  expect(events).toHaveLength(1)
})

test("countMeetings excludes all-day and respects the window", () => {
  const events = parseEvents(SAMPLE)
  const from = new Date(2026, 7, 3)
  const to = new Date(2026, 7, 10)
  expect(countMeetings(events, from, to)).toBe(3)
  expect(countMeetings(events, from, to, { includeAllDay: true })).toBe(4)
  // A window covering only Monday.
  expect(countMeetings(events, from, new Date(2026, 7, 4))).toBe(2)
})

test("nextEvent picks the earliest still-upcoming meeting", () => {
  const events = parseEvents(SAMPLE)
  expect(nextEvent(events, new Date(2026, 7, 3, 8, 0))?.title).toBe("Standup")
  expect(nextEvent(events, new Date(2026, 7, 3, 10, 0))?.title).toBe(
    "Internal Sync",
  )
  // All-day entries are not "next meetings".
  expect(nextEvent(events, new Date(2026, 7, 4, 0, 0))?.title).toBe("1:1")
  expect(nextEvent(events, new Date(2026, 7, 9, 0, 0))).toBeNull()
})

test("nextEvent treats an event starting exactly now as upcoming", () => {
  const events = parseEvents(SAMPLE)
  expect(nextEvent(events, new Date(2026, 7, 3, 9, 30))?.title).toBe("Standup")
})

test("localEvents passes the date range and calendar filter through", () => {
  const calls: string[][] = []
  const runner: Runner = (cmd, args) => {
    calls.push([cmd, ...args])
    return SAMPLE
  }
  const events = localEvents(new Date(2026, 7, 3), new Date(2026, 7, 10), {
    runner,
    calendars: ["work@example.com"],
    candidates: ["icalBuddy"],
  })
  expect(events).toHaveLength(4)
  const args = calls[0] ?? []
  expect(args).toContain("eventsFrom:2026-08-03")
  expect(args).toContain("to:2026-08-10")
  expect(args).toContain("-ic")
  expect(args).toContain("work@example.com")
  // Property restriction matters: without it icalBuddy emits notes/attendees.
  expect(args).toContain("-iep")
})

test("localEvents falls through candidate paths until one works", () => {
  const tried: string[] = []
  const runner: Runner = (cmd) => {
    tried.push(cmd)
    if (cmd !== "/opt/homebrew/bin/icalBuddy") {
      throw new Error("ENOENT")
    }
    return SAMPLE
  }
  const events = localEvents(new Date(2026, 7, 3), new Date(2026, 7, 10), {
    runner,
  })
  expect(events).toHaveLength(4)
  expect(tried).toEqual(["icalBuddy", "/opt/homebrew/bin/icalBuddy"])
})

test("localEvents says 'not installed' when no candidate exists", () => {
  const runner: Runner = () => {
    throw new Error("spawnSync icalBuddy ENOENT")
  }
  expect(() =>
    localEvents(new Date(2026, 7, 3), new Date(2026, 7, 10), { runner }),
  ).toThrow(/not installed/)
})

test("localEvents points at the privacy grant when the binary ran but failed", () => {
  // Distinct from ENOENT: icalBuddy is installed, but EventKit refused it —
  // which on macOS means the *host app* lacks a Calendar grant. Conflating the
  // two sends you off to reinstall a tool that is already there.
  const runner: Runner = () => {
    throw new Error("Command failed: exit 1")
  }
  expect(() =>
    localEvents(new Date(2026, 7, 3), new Date(2026, 7, 10), { runner }),
  ).toThrow(/Calendar permission|Privacy & Security/)
})

test("isoDate formats in local time", () => {
  expect(isoDate(new Date(2026, 7, 3))).toBe("2026-08-03")
  expect(isoDate(new Date(2026, 11, 9, 23, 59))).toBe("2026-12-09")
})

test("minutesUntil floors and never goes negative", () => {
  const now = new Date(2026, 7, 3, 9, 0)
  expect(minutesUntil(new Date(2026, 7, 3, 9, 30), now)).toBe(30)
  expect(minutesUntil(new Date(2026, 7, 3, 9, 0, 45), now)).toBe(0)
  expect(minutesUntil(new Date(2026, 7, 3, 8, 0), now)).toBe(0)
})

test("formatCountdown stays compact enough for a key", () => {
  expect(formatCountdown(0)).toBe("now")
  expect(formatCountdown(9)).toBe("9m")
  expect(formatCountdown(59)).toBe("59m")
  expect(formatCountdown(60)).toBe("1h00")
  expect(formatCountdown(95)).toBe("1h35")
})

test("shortTitle collapses whitespace and ellipsises", () => {
  expect(shortTitle("Standup")).toBe("Standup")
  // Collapsed to "Internal Corza Sync" (19), then cut to `max` *including*
  // the ellipsis — 13 characters plus "…".
  expect(shortTitle("Internal   Corza\nSync")).toBe("Internal Corz…")
  expect(shortTitle("Internal   Corza\nSync")).toHaveLength(14)
  expect(shortTitle("abc", 2)).toBe("a…")
})
