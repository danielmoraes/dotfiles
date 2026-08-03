import { type LocalEvent, type Runner, localEvents } from "./index"
import { eventsInRange } from "./ics"

/**
 * One way to ask for calendar events, whichever source is available.
 *
 * Two exist because neither works everywhere:
 *
 * - **`.ics` feed** — needs a private feed URL. Workspace admins can disable the
 *   per-calendar secret address, in which case there's nothing to point at.
 * - **local macOS Calendar** — needs a Calendar privacy grant for the *host
 *   app*. macOS only prompts when the app itself asks, and Stream Deck spawns
 *   `node` → `icalBuddy`, so the child is denied silently and never prompts.
 *
 * Prefer the feed when a URL is configured: it's the one that works without a
 * privacy grant, and it doesn't depend on the desktop app being signed in.
 */

/** A fetch shape narrow enough to fake in tests without DOM lib types. */
export type FetchText = (url: string) => Promise<string>

const FETCH_TIMEOUT_MS = 20_000

const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`iCal feed failed: HTTP ${res.status}`)
  }
  return res.text()
}

export type SourceOptions = {
  /** Private `.ics` feed. Omitted or empty falls back to the local calendar. */
  icalUrl?: string
  /** Restrict the local read to these calendar names. */
  calendars?: readonly string[]
  /** Injected shell runner for the local read (testing). */
  runner?: Runner
  /** Seconds a fetched feed stays warm. */
  cacheSeconds?: number
  fetchText?: FetchText
  /** Treat this instant as "now" (testing). */
  now?: Date
}

type CacheEntry = { at: number; body: string }

/**
 * A Google feed is measured in megabytes (thousands of VEVENTs, most of them
 * years old). A key polling every 60s must not re-download that each tick, so
 * the body is cached and only the cheap re-parse runs in between.
 */
const cache = new Map<string, CacheEntry>()

const DEFAULT_CACHE_SECONDS = 600

/** Drop cached feeds — exported for tests, which must not share state. */
export function clearFeedCache(): void {
  cache.clear()
}

async function feedBody(
  url: string,
  opts: SourceOptions,
  nowMs: number,
): Promise<string> {
  const ttl = (opts.cacheSeconds ?? DEFAULT_CACHE_SECONDS) * 1_000
  const hit = cache.get(url)
  if (hit && nowMs - hit.at < ttl) {
    return hit.body
  }
  const body = await (opts.fetchText ?? defaultFetchText)(url)
  cache.set(url, { at: nowMs, body })
  return body
}

/**
 * Events between `from` and `to`, from whichever source is configured.
 *
 * `to` is exclusive, matching how the callers window a day or a week.
 */
export async function calendarEvents(
  from: Date,
  to: Date,
  opts: SourceOptions = {},
): Promise<LocalEvent[]> {
  const url = opts.icalUrl
  if (url !== undefined && url !== "") {
    const now = opts.now ?? new Date()
    const body = await feedBody(url, opts, now.getTime())
    return eventsInRange(body, from, to).map((event) => ({
      start: event.start,
      allDay: event.allDay,
      title: event.summary,
    }))
  }
  // icalBuddy's `to:` is inclusive of that day, so ask for one day less.
  const lastDay = new Date(to.getTime())
  lastDay.setDate(lastDay.getDate() - 1)
  return localEvents(from, lastDay, {
    calendars: opts.calendars,
    runner: opts.runner,
  })
}
