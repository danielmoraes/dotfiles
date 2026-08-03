/**
 * A small iCalendar (RFC 5545) reader — just enough to answer "how many
 * meetings did I have this week?" from a private .ics feed.
 *
 * Deliberately partial. It handles the shapes real Google/Outlook/iCloud feeds
 * emit for ordinary meetings: folded lines, `DTSTART` as date or date-time,
 * cancelled events, `EXDATE`, and `RRULE` with `FREQ=DAILY|WEEKLY`,
 * `INTERVAL`, `COUNT`, `UNTIL` and `BYDAY`. Monthly/yearly recurrence,
 * `BYSETPOS`, and `RDATE` are not expanded — those are rare for meetings and
 * getting them subtly wrong is worse than not counting them.
 *
 * Timezones are an approximation: a `Z` suffix is UTC, anything else (including
 * `TZID=`) is read as local wall-clock time. For bucketing events into a week
 * that is right except within an hour of a week boundary.
 */

export type Event = {
  start: Date
  /** True for `VALUE=DATE` entries — all-day blocks, not meetings. */
  allDay: boolean
  summary: string
}

type Property = {
  name: string
  params: Record<string, string>
  value: string
}

/** Undo RFC 5545 line folding: continuation lines begin with a space or tab. */
function unfold(text: string): string[] {
  const lines: string[] = []
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1)
    } else {
      lines.push(raw)
    }
  }
  return lines
}

/** Split `NAME;PARAM=X:value` into its parts. */
function parseProperty(line: string): Property | null {
  const colon = line.indexOf(":")
  if (colon === -1) {
    return null
  }
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...paramParts] = head.split(";")
  const params: Record<string, string> = {}
  for (const part of paramParts) {
    const eq = part.indexOf("=")
    if (eq !== -1) {
      params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1)
    }
  }
  return { name: (name ?? "").toUpperCase(), params, value }
}

/**
 * Parse `YYYYMMDD` or `YYYYMMDDTHHMMSS[Z]`.
 *
 * Without a `Z` the timestamp is local wall-clock time, so it is built with the
 * `Date` component constructor rather than `Date.parse`.
 */
export function parseIcsDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
    value.trim(),
  )
  if (!match) {
    return null
  }
  const [, y, mo, d, h = "0", mi = "0", s = "0", utc] = match
  const parts = [y, mo, d, h, mi, s].map((p) => Number(p))
  const [year, month, day, hour, minute, second] = parts
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return null
  }
  return utc
    ? new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    : new Date(year, month - 1, day, hour, minute, second)
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]

/** Parse `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE` into a lookup. */
function parseRule(value: string): Record<string, string> {
  const rule: Record<string, string> = {}
  for (const part of value.split(";")) {
    const eq = part.indexOf("=")
    if (eq !== -1) {
      rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).toUpperCase()
    }
  }
  return rule
}

/** Copy `date`, moving it to a different calendar day but keeping the time. */
function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Expand a recurring event into the occurrences that land in [from, to).
 *
 * Walks day-by-day from the series start, which is cheap for the week-sized
 * windows this plugin asks about and avoids per-frequency date arithmetic.
 */
function expand(
  start: Date,
  rule: Record<string, string>,
  from: Date,
  to: Date,
): Date[] {
  const freq = rule.FREQ
  if (freq !== "DAILY" && freq !== "WEEKLY") {
    // Unsupported frequency: count only the series' own start date.
    return start >= from && start < to ? [start] : []
  }

  const interval = Math.max(Number(rule.INTERVAL ?? "1") || 1, 1)
  const count = rule.COUNT ? Number(rule.COUNT) : undefined
  const until = rule.UNTIL ? parseIcsDate(rule.UNTIL) : null
  const byDay = rule.BYDAY
    ? rule.BYDAY.split(",").map((d) => d.trim().slice(-2))
    : null

  const hits: Date[] = []
  let emitted = 0
  // Cap the walk so a malformed endless rule can't spin: a year is far beyond
  // any window this plugin queries.
  const horizon = new Date(
    Math.min(to.getTime(), start.getTime() + 366 * DAY_MS),
  )

  for (
    let cursor = new Date(start.getTime());
    cursor < horizon;
    cursor = addDays(cursor, 1)
  ) {
    if (until && cursor > until) {
      break
    }
    if (count !== undefined && emitted >= count) {
      break
    }

    const dayOffset = Math.round((cursor.getTime() - start.getTime()) / DAY_MS)
    const matches =
      freq === "DAILY"
        ? dayOffset % interval === 0
        : byDay
          ? // Weekly with BYDAY: the named weekdays, every `interval` weeks.
            byDay.includes(WEEKDAYS[cursor.getDay()] ?? "") &&
            Math.floor(dayOffset / 7) % interval === 0
          : dayOffset % (7 * interval) === 0

    if (!matches) {
      continue
    }
    emitted++
    if (cursor >= from) {
      hits.push(new Date(cursor.getTime()))
    }
  }
  return hits
}

/** Every event occurrence in [from, to), recurrence expanded. */
export function eventsInRange(ics: string, from: Date, to: Date): Event[] {
  const events: Event[] = []
  let current: {
    start?: Date
    allDay: boolean
    summary: string
    rrule?: string
    exdates: number[]
    cancelled: boolean
  } | null = null

  for (const line of unfold(ics)) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = { allDay: false, summary: "", exdates: [], cancelled: false }
      continue
    }
    if (line.startsWith("END:VEVENT")) {
      if (current?.start && !current.cancelled) {
        const occurrences = current.rrule
          ? expand(current.start, parseRule(current.rrule), from, to)
          : current.start >= from && current.start < to
            ? [current.start]
            : []
        for (const start of occurrences) {
          if (current.exdates.includes(start.getTime())) {
            continue
          }
          events.push({
            start,
            allDay: current.allDay,
            summary: current.summary,
          })
        }
      }
      current = null
      continue
    }
    if (!current) {
      continue
    }

    const prop = parseProperty(line)
    if (!prop) {
      continue
    }
    switch (prop.name) {
      case "DTSTART": {
        const parsed = parseIcsDate(prop.value)
        if (parsed) {
          current.start = parsed
          current.allDay = prop.params.VALUE === "DATE"
        }
        break
      }
      case "RRULE":
        current.rrule = prop.value
        break
      case "EXDATE":
        for (const raw of prop.value.split(",")) {
          const parsed = parseIcsDate(raw)
          if (parsed) {
            current.exdates.push(parsed.getTime())
          }
        }
        break
      case "SUMMARY":
        current.summary = prop.value
        break
      case "STATUS":
        current.cancelled = prop.value.toUpperCase() === "CANCELLED"
        break
      default:
        break
    }
  }

  return events
}

/**
 * Count meetings in [from, to).
 *
 * All-day entries are excluded by default — on a work calendar those are
 * out-of-office, holidays and travel banners, not meetings you attended.
 */
export function countMeetings(
  ics: string,
  from: Date,
  to: Date,
  { includeAllDay = false }: { includeAllDay?: boolean } = {},
): number {
  return eventsInRange(ics, from, to).filter(
    (event) => includeAllDay || !event.allDay,
  ).length
}
