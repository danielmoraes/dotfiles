import { expect, test } from "vite-plus/test"
import { parseEvents } from "streamdeck-ical"
import { nextMeetingFace } from "./render"

const EVENTS = parseEvents(
  [
    "2026-08-03 at 09:30\tStandup",
    "2026-08-03 at 12:00\tInternal Corza Sync",
    "2026-08-04\tOOO",
    "2026-08-05 at 16:00\t1:1",
  ].join("\n"),
)

test("shows the next meeting title over a countdown", () => {
  const face = nextMeetingFace(EVENTS, new Date(2026, 7, 3, 9, 0))
  expect(face.title).toBe("Standup\n30m")
  expect(face.state).toBe(0)
})

test("flips to the imminent state inside warnMinutes", () => {
  const now = new Date(2026, 7, 3, 9, 22)
  expect(nextMeetingFace(EVENTS, now).state).toBe(1)
  // Boundary: exactly warnMinutes away still counts as imminent.
  expect(nextMeetingFace(EVENTS, new Date(2026, 7, 3, 9, 20)).state).toBe(1)
  expect(nextMeetingFace(EVENTS, new Date(2026, 7, 3, 9, 19)).state).toBe(0)
  // And it's configurable.
  expect(
    nextMeetingFace(EVENTS, new Date(2026, 7, 3, 9, 0), { warnMinutes: 45 })
      .state,
  ).toBe(1)
})

test("a meeting starting now reads `now`, not a negative countdown", () => {
  const face = nextMeetingFace(EVENTS, new Date(2026, 7, 3, 9, 30))
  expect(face.title).toBe("Standup\nnow")
  expect(face.state).toBe(1)
})

test("long titles are trimmed to fit the key", () => {
  const face = nextMeetingFace(EVENTS, new Date(2026, 7, 3, 10, 0))
  const [title, countdown] = face.title.split("\n")
  expect(title).toBe("Internal Corz…")
  expect(countdown).toBe("2h00")
})

test("all-day banners are skipped, not shown as the next meeting", () => {
  // Tuesday is only an OOO banner; the next real meeting is Wednesday's 1:1.
  const face = nextMeetingFace(EVENTS, new Date(2026, 7, 4, 0, 0))
  expect(face.title.split("\n")[0]).toBe("1:1")
  // Unless you ask for them.
  const withAllDay = nextMeetingFace(EVENTS, new Date(2026, 7, 4, 0, 0), {
    includeAllDay: true,
  })
  expect(withAllDay.title.split("\n")[0]).toBe("OOO")
})

test("an empty calendar reads `clear` rather than erroring", () => {
  expect(nextMeetingFace([], new Date(2026, 7, 3, 9, 0))).toEqual({
    title: "clear",
    state: 0,
  })
  // Same once everything is in the past.
  expect(nextMeetingFace(EVENTS, new Date(2026, 7, 9)).title).toBe("clear")
})
