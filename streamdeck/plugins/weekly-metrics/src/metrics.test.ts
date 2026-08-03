import { expect, test } from "vite-plus/test"
import {
  type FetchLike,
  type MetricKind,
  codingHours,
  commits,
  fetchMetric,
  isMetricKind,
  isoDate,
  meetings,
  nextKind,
  prsMerged,
  weekStart,
} from "./metrics"

/** Wednesday 2026-08-05, 15:00 local. */
const NOW = new Date(2026, 7, 5, 15, 0, 0)

function fakeFetch(body: unknown, { ok = true, status = 200, text = "" } = {}) {
  const calls: string[] = []
  const impl: FetchLike = async (url) => {
    calls.push(url)
    return { ok, status, json: async () => body, text: async () => text }
  }
  return { impl, calls }
}

test("weekStart snaps back to Monday midnight", () => {
  expect(weekStart(NOW)).toEqual(new Date(2026, 7, 3))
  // Sunday belongs to the week that started the previous Monday.
  expect(weekStart(new Date(2026, 7, 9, 23, 59))).toEqual(new Date(2026, 7, 3))
  // Monday is already the start.
  expect(weekStart(new Date(2026, 7, 3, 0, 30))).toEqual(new Date(2026, 7, 3))
})

test("isoDate formats in local time", () => {
  expect(isoDate(new Date(2026, 7, 3))).toBe("2026-08-03")
  expect(isoDate(new Date(2026, 11, 9))).toBe("2026-12-09")
})

test("codingHours converts WakaTime seconds to hours", async () => {
  const { impl, calls } = fakeFetch({ cumulative_total: { seconds: 45000 } })
  const hours = await codingHours({
    wakatimeApiKey: "key",
    wakatimeBase: "https://wt.test",
    fetchImpl: impl,
    now: NOW,
  })
  expect(hours).toBeCloseTo(12.5)
  expect(calls[0]).toBe(
    "https://wt.test/users/current/summaries?start=2026-08-03&end=2026-08-05",
  )
})

test("codingHours requires an API key", async () => {
  await expect(codingHours({ now: NOW })).rejects.toThrow(/WAKATIME_API_KEY/)
})

test("codingHours returns 0 when the payload has no total", async () => {
  const { impl } = fakeFetch({})
  expect(
    await codingHours({ wakatimeApiKey: "k", fetchImpl: impl, now: NOW }),
  ).toBe(0)
})

test("prsMerged searches from Monday", async () => {
  const { impl, calls } = fakeFetch({ total_count: 4 })
  expect(
    await prsMerged({
      githubBase: "https://gh.test",
      fetchImpl: impl,
      now: NOW,
    }),
  ).toBe(4)
  expect(calls[0]).toContain("merged%3A%3E%3D2026-08-03")
  expect(calls[0]).toContain("author%3A%40me")
})

test("commits needs a login and searches the commits index", async () => {
  await expect(commits({ now: NOW })).rejects.toThrow(/githubLogin/)

  const { impl, calls } = fakeFetch({ total_count: 12 })
  expect(
    await commits({
      githubLogin: "danielmoraes",
      githubBase: "https://gh.test",
      fetchImpl: impl,
      now: NOW,
    }),
  ).toBe(12)
  expect(calls[0]).toContain("/search/commits?")
  expect(calls[0]).toContain("author%3Adanielmoraes")
})

test("meetings counts events in the current week from the feed", async () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART:20260804T100000",
    "SUMMARY:Sync",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART:20260811T100000",
    "SUMMARY:Next week",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  const { impl } = fakeFetch(null, { text: ics })
  expect(
    await meetings({
      icalUrl: "https://cal.test/feed.ics",
      fetchImpl: impl,
      now: NOW,
    }),
  ).toBe(1)
})

test("meetings reads the local calendar when no feed URL is set", async () => {
  // Injected runner: never touch the real Calendar store from a test — it's
  // non-deterministic, and icalBuddy doesn't exist on the Linux CI runner.
  const calls: string[][] = []
  const runner = (cmd: string, args: string[]): string => {
    calls.push([cmd, ...args])
    return [
      "2026-08-03 at 09:30\tStandup",
      "2026-08-05 at 16:00\t1:1",
      "2026-08-06\tOOO",
      // Outside the week — must not be counted.
      "2026-08-11 at 10:00\tNext week",
    ].join("\n")
  }
  expect(await meetings({ now: NOW, runner })).toBe(2)
  // Week runs Mon 03 .. Sun 09; icalBuddy's `to:` is inclusive of that day.
  expect(calls[0]).toContain("eventsFrom:2026-08-03")
  expect(calls[0]).toContain("to:2026-08-09")
})

test("meetings can include all-day entries from the local calendar", async () => {
  const runner = (): string =>
    ["2026-08-03 at 09:30\tStandup", "2026-08-06\tOOO"].join("\n")
  expect(await meetings({ now: NOW, runner })).toBe(1)
  expect(
    await meetings({ now: NOW, runner, includeAllDayMeetings: true }),
  ).toBe(2)
})

test("meetings restricts to the configured calendars", async () => {
  const calls: string[][] = []
  const runner = (cmd: string, args: string[]): string => {
    calls.push([cmd, ...args])
    return ""
  }
  await meetings({ now: NOW, runner, calendars: ["work@example.com"] })
  expect(calls[0]).toContain("-ic")
  expect(calls[0]).toContain("work@example.com")
})

test("fetchMetric formats each kind for the key", async () => {
  const coding = await fetchMetric("coding", {
    wakatimeApiKey: "k",
    fetchImpl: fakeFetch({ cumulative_total: { seconds: 3600 } }).impl,
    now: NOW,
  })
  expect(coding).toEqual({ kind: "coding", label: "CODE", value: "1.0h" })

  const prs = await fetchMetric("prs-merged", {
    fetchImpl: fakeFetch({ total_count: 7 }).impl,
    now: NOW,
  })
  expect(prs).toEqual({ kind: "prs-merged", label: "PRS", value: "7" })
})

test("isMetricKind guards the settings payload", () => {
  expect(isMetricKind("coding")).toBe(true)
  expect(isMetricKind("meetings")).toBe(true)
  expect(isMetricKind("nope")).toBe(false)
  expect(isMetricKind(3)).toBe(false)
})

test("nextKind cycles and wraps", () => {
  const cycle: MetricKind[] = ["coding", "prs-merged", "meetings"]
  expect(nextKind("coding", cycle)).toBe("prs-merged")
  expect(nextKind("prs-merged", cycle)).toBe("meetings")
  expect(nextKind("meetings", cycle)).toBe("coding")
  // A metric outside the cycle starts it from the beginning.
  expect(nextKind("commits", cycle)).toBe("coding")
  expect(nextKind("coding", [])).toBe("coding")
})
