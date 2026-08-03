import { expect, test } from "vite-plus/test"
import { type Runner, calendarEvents, clearFeedCache } from "./index"

const FROM = new Date(2026, 7, 3)
const TO = new Date(2026, 7, 10)

const FEED = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20260804T100000",
  "SUMMARY:Sync",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260805",
  "SUMMARY:OOO",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n")

/** icalBuddy's line-per-event output. */
const LOCAL = "2026-08-04 at 10:00\tSync\n2026-08-05\tOOO"

test("a feed URL wins over the local calendar", async () => {
  clearFeedCache()
  let localCalled = false
  const runner: Runner = () => {
    localCalled = true
    return LOCAL
  }
  const events = await calendarEvents(FROM, TO, {
    icalUrl: "https://cal.test/f.ics",
    fetchText: async () => FEED,
    runner,
  })
  expect(events.map((e) => e.title)).toEqual(["Sync", "OOO"])
  expect(localCalled).toBe(false)
})

test("no feed URL falls back to the local calendar", async () => {
  clearFeedCache()
  const calls: string[][] = []
  const runner: Runner = (cmd, args) => {
    calls.push([cmd, ...args])
    return LOCAL
  }
  const events = await calendarEvents(FROM, TO, { runner })
  expect(events.map((e) => e.title)).toEqual(["Sync", "OOO"])
  // `to` is exclusive for us but inclusive for icalBuddy, so it asks for 08-09.
  expect(calls[0]).toContain("to:2026-08-09")
})

test("an empty feed URL is treated as unset", async () => {
  clearFeedCache()
  const runner: Runner = () => LOCAL
  const events = await calendarEvents(FROM, TO, { icalUrl: "", runner })
  expect(events).toHaveLength(2)
})

test("all-day entries survive the feed path with their flag intact", async () => {
  clearFeedCache()
  const events = await calendarEvents(FROM, TO, {
    icalUrl: "https://cal.test/f.ics",
    fetchText: async () => FEED,
  })
  expect(events.find((e) => e.title === "OOO")?.allDay).toBe(true)
  expect(events.find((e) => e.title === "Sync")?.allDay).toBe(false)
})

test("the feed body is cached, not re-fetched every call", async () => {
  // A Google feed runs to megabytes; a key polling every 60s must not
  // re-download it each tick.
  clearFeedCache()
  let fetches = 0
  const fetchText = async (): Promise<string> => {
    fetches++
    return FEED
  }
  const opts = {
    icalUrl: "https://cal.test/cached.ics",
    fetchText,
    cacheSeconds: 600,
  }
  await calendarEvents(FROM, TO, { ...opts, now: new Date(2026, 7, 3, 9, 0) })
  await calendarEvents(FROM, TO, { ...opts, now: new Date(2026, 7, 3, 9, 5) })
  expect(fetches).toBe(1)
})

test("the cache expires once its TTL passes", async () => {
  clearFeedCache()
  let fetches = 0
  const fetchText = async (): Promise<string> => {
    fetches++
    return FEED
  }
  const opts = {
    icalUrl: "https://cal.test/ttl.ics",
    fetchText,
    cacheSeconds: 60,
  }
  await calendarEvents(FROM, TO, { ...opts, now: new Date(2026, 7, 3, 9, 0) })
  await calendarEvents(FROM, TO, { ...opts, now: new Date(2026, 7, 3, 9, 2) })
  expect(fetches).toBe(2)
})

test("different feeds are cached separately", async () => {
  clearFeedCache()
  const seen: string[] = []
  const fetchText = async (url: string): Promise<string> => {
    seen.push(url)
    return FEED
  }
  const now = new Date(2026, 7, 3, 9, 0)
  await calendarEvents(FROM, TO, {
    icalUrl: "https://a.test/f",
    fetchText,
    now,
  })
  await calendarEvents(FROM, TO, {
    icalUrl: "https://b.test/f",
    fetchText,
    now,
  })
  expect(seen).toEqual(["https://a.test/f", "https://b.test/f"])
})

test("a failing feed surfaces rather than silently going local", async () => {
  // Falling back on error would show a plausible-but-wrong count whenever the
  // network hiccups. Better that the key says something is wrong.
  clearFeedCache()
  await expect(
    calendarEvents(FROM, TO, {
      icalUrl: "https://cal.test/dead.ics",
      fetchText: async () => {
        throw new Error("HTTP 404")
      },
    }),
  ).rejects.toThrow(/404/)
})
