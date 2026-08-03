import { execFileSync } from "node:child_process"

/**
 * Read events from the macOS Calendar store via `icalBuddy`.
 *
 * Preferred over an `.ics` feed URL: Google Workspace domains commonly disable
 * the per-calendar "secret address", which leaves no private feed to point at —
 * but the same calendar is already synced into Calendar.app. Reading locally
 * also means no token to store, no network call, and recurrence/timezones are
 * resolved by EventKit rather than by a hand-rolled RFC 5545 parser.
 *
 * The trade is a macOS dependency and a Calendar privacy grant for whichever
 * process runs this (the Stream Deck app, the first time a key asks).
 */

export type LocalEvent = {
  start: Date
  /** True for entries with no time-of-day — OOO/holiday banners, not meetings. */
  allDay: boolean
  title: string
}

/** How the reader shells out; injectable so parsing is testable. */
export type Runner = (cmd: string, args: string[]) => string

/**
 * Where `icalBuddy` might live.
 *
 * Same launchd problem as `gh` in `streamdeck/secrets`: the Stream Deck app is
 * started with `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, so a bare name never
 * resolves in the environment the plugins actually run in.
 */
export const ICALBUDDY_CANDIDATES = [
  "icalBuddy",
  "/opt/homebrew/bin/icalBuddy",
  "/usr/local/bin/icalBuddy",
]

const runCommand: Runner = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    // A calendar store that needs to spin up CalDAV sync can be slow; bound it
    // so a key can't hang forever waiting to paint.
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
  })

export type ReadOptions = {
  /** Restrict to these calendar names; all calendars when omitted. */
  calendars?: readonly string[]
  runner?: Runner
  candidates?: readonly string[]
}

/** `YYYY-MM-DD` in local time — the form icalBuddy's date args expect. */
export function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Flags that pin the output to one line per event: `DATE at HH:MM<TAB>TITLE`,
 * or `DATE<TAB>TITLE` for an all-day entry.
 *
 * `-iep` restricts which properties are emitted at all — without it icalBuddy
 * also prints notes and attendee lists, which run to many lines each and would
 * both break the line-per-event parse and pull meeting contents into memory.
 */
function formatArgs(): string[] {
  return [
    "-nc", // no calendar names
    "-nrd", // no "today"/"tomorrow" relative dates
    "-npn", // no property names
    "-eed", // no end datetimes
    "-b",
    "",
    "-ps",
    "|\t|",
    "-iep",
    "datetime,title",
    "-po",
    "datetime,title",
    "-df",
    "%Y-%m-%d",
    "-tf",
    "%H:%M",
  ]
}

/** Parse icalBuddy's line-per-event output. */
export function parseEvents(output: string): LocalEvent[] {
  const events: LocalEvent[] = []
  for (const raw of output.split("\n")) {
    const line = raw.trimEnd()
    if (line === "") {
      continue
    }
    const tab = line.indexOf("\t")
    if (tab === -1) {
      continue
    }
    const when = line.slice(0, tab).trim()
    const title = line.slice(tab + 1).trim()

    const timed = /^(\d{4})-(\d{2})-(\d{2}) at (\d{2}):(\d{2})$/.exec(when)
    const allDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(when)
    const parts = timed ?? allDay
    if (!parts) {
      // A wrapped continuation line from an unexpected property — skip it
      // rather than inventing an event.
      continue
    }
    const [, y, mo, d, h = "0", mi = "0"] = parts
    events.push({
      start: new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
      ),
      allDay: timed === null,
      title,
    })
  }
  return events
}

/** Every event between `from` and `to` (inclusive of the `to` day). */
export function localEvents(
  from: Date,
  to: Date,
  opts: ReadOptions = {},
): LocalEvent[] {
  const runner = opts.runner ?? runCommand
  const args = [
    ...formatArgs(),
    ...(opts.calendars && opts.calendars.length > 0
      ? ["-ic", opts.calendars.join(",")]
      : []),
    `eventsFrom:${isoDate(from)}`,
    `to:${isoDate(to)}`,
  ]
  for (const bin of opts.candidates ?? ICALBUDDY_CANDIDATES) {
    try {
      return parseEvents(runner(bin, args))
    } catch {
      // Not at this path, or it failed — try the next.
    }
  }
  throw new Error(
    "icalBuddy not found or not permitted (install: brew install ical-buddy)",
  )
}

/**
 * Count meetings in [from, to).
 *
 * All-day entries are excluded by default — on a work calendar those are
 * out-of-office, holidays and travel banners rather than meetings attended.
 */
export function countMeetings(
  events: readonly LocalEvent[],
  from: Date,
  to: Date,
  { includeAllDay = false }: { includeAllDay?: boolean } = {},
): number {
  return events.filter(
    (e) => (includeAllDay || !e.allDay) && e.start >= from && e.start < to,
  ).length
}

/** The next event starting at or after `now`, ignoring all-day banners. */
export function nextEvent(
  events: readonly LocalEvent[],
  now: Date,
  { includeAllDay = false }: { includeAllDay?: boolean } = {},
): LocalEvent | null {
  const upcoming = events
    .filter((e) => (includeAllDay || !e.allDay) && e.start >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  return upcoming[0] ?? null
}

/** Whole minutes until `start`, floored at 0. */
export function minutesUntil(start: Date, now: Date): number {
  return Math.max(Math.floor((start.getTime() - now.getTime()) / 60_000), 0)
}

/** Compact countdown for a key: `12m`, `1h05`, `now`. */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) {
    return "now"
  }
  if (minutes < 60) {
    return `${minutes}m`
  }
  const h = Math.floor(minutes / 60)
  return `${h}h${String(minutes % 60).padStart(2, "0")}`
}

/** Trim a title to something that fits a 72px key without wrapping oddly. */
export function shortTitle(title: string, max = 14): string {
  const clean = title.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}
