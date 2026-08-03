import { expect, test } from "vite-plus/test"
import { countMeetings, eventsInRange, parseIcsDate } from "./ics"

/** Monday 2026-08-03 .. Monday 2026-08-10, local time. */
const FROM = new Date(2026, 7, 3)
const TO = new Date(2026, 7, 10)

function calendar(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...events.flatMap((body) => ["BEGIN:VEVENT", body, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n")
}

test("parseIcsDate reads dates, local date-times and UTC date-times", () => {
  expect(parseIcsDate("20260803")).toEqual(new Date(2026, 7, 3))
  expect(parseIcsDate("20260803T093000")).toEqual(
    new Date(2026, 7, 3, 9, 30, 0),
  )
  expect(parseIcsDate("20260803T093000Z")).toEqual(
    new Date(Date.UTC(2026, 7, 3, 9, 30, 0)),
  )
  expect(parseIcsDate("nope")).toBeNull()
})

test("counts a single timed meeting inside the window", () => {
  const ics = calendar("DTSTART:20260805T140000\r\nSUMMARY:Standup")
  expect(countMeetings(ics, FROM, TO)).toBe(1)
})

test("ignores events outside the window", () => {
  const ics = calendar(
    "DTSTART:20260801T140000\r\nSUMMARY:Last week",
    "DTSTART:20260812T140000\r\nSUMMARY:Next week",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(0)
})

test("excludes all-day entries by default but can include them", () => {
  const ics = calendar("DTSTART;VALUE=DATE:20260805\r\nSUMMARY:PTO")
  expect(countMeetings(ics, FROM, TO)).toBe(0)
  expect(countMeetings(ics, FROM, TO, { includeAllDay: true })).toBe(1)
})

test("skips cancelled events", () => {
  const ics = calendar(
    "DTSTART:20260805T140000\r\nSTATUS:CANCELLED\r\nSUMMARY:Dropped",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(0)
})

test("expands a daily rule across the week", () => {
  const ics = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Daily",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(7)
})

test("honours INTERVAL on a daily rule", () => {
  const ics = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=DAILY;INTERVAL=2\r\nSUMMARY:Alt",
  )
  // Mon, Wed, Fri, Sun.
  expect(countMeetings(ics, FROM, TO)).toBe(4)
})

test("honours COUNT and UNTIL", () => {
  const counted = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Three",
  )
  expect(countMeetings(counted, FROM, TO)).toBe(3)

  const until = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=DAILY;UNTIL=20260805T235959\r\nSUMMARY:Til",
  )
  expect(countMeetings(until, FROM, TO)).toBe(3)
})

test("expands a weekly rule with BYDAY", () => {
  const ics = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\nSUMMARY:MWF",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(3)
})

test("a weekly rule without BYDAY repeats on the start weekday", () => {
  const ics = calendar(
    "DTSTART:20260727T090000\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Weekly",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(1)
})

test("EXDATE removes a specific occurrence", () => {
  const ics = calendar(
    "DTSTART:20260803T090000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20260804T090000\r\nSUMMARY:Gap",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(2)
})

test("unfolds continuation lines", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART:20260805T140000",
    "SUMMARY:A very long meeting title that the",
    "  server wrapped",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  const [event] = eventsInRange(ics, FROM, TO)
  expect(event?.summary).toBe(
    "A very long meeting title that the server wrapped",
  )
})

test("unsupported frequencies fall back to the series start only", () => {
  const ics = calendar(
    "DTSTART:20260805T090000\r\nRRULE:FREQ=MONTHLY\r\nSUMMARY:Monthly",
  )
  expect(countMeetings(ics, FROM, TO)).toBe(1)
})
