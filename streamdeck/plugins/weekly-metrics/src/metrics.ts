import { countMeetings } from "./ics"

/**
 * Pure "this week" metric fetchers. No Stream Deck dependencies so they can be
 * unit tested with an injected `fetchImpl` and a fixed clock.
 */

export type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

/** Minimal fetch shape so tests can inject a mock without DOM lib types. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>

/** Which metric a key is showing. */
export type MetricKind = "coding" | "prs-merged" | "commits" | "meetings"

export const METRIC_KINDS: readonly MetricKind[] = [
  "coding",
  "prs-merged",
  "commits",
  "meetings",
]

export function isMetricKind(value: unknown): value is MetricKind {
  return typeof value === "string" && METRIC_KINDS.some((k) => k === value)
}

export type MetricConfig = {
  wakatimeApiKey?: string
  githubToken?: string
  /** GitHub login; required for the commits metric (commit search has no @me). */
  githubLogin?: string
  /** Private iCal feed URL for the meetings metric. */
  icalUrl?: string
  /** Override API bases (testing). */
  wakatimeBase?: string
  githubBase?: string
  fetchImpl?: FetchLike
  /** Treat this instant as "now" (testing). */
  now?: Date
  /** Count all-day calendar entries as meetings. */
  includeAllDayMeetings?: boolean
}

export type Metric = {
  kind: MetricKind
  /** Short label for the key, e.g. "CODE". */
  label: string
  /** Formatted value for the key, e.g. "12.5h". */
  value: string
}

const WAKATIME_BASE = "https://wakatime.com/api/v1"
const GITHUB_BASE = "https://api.github.com"

/**
 * Requests are bounded: a hung connection would otherwise leave the key blank
 * forever — `render` awaits this, so not even the `!` error state would paint.
 */
const FETCH_TIMEOUT_MS = 10_000

const defaultFetch: FetchLike = async (url, init) => {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const res = await fetch(url, { ...init, signal })
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json(),
    text: () => res.text(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Monday 00:00 local time of the week containing `now`. */
export function weekStart(now: Date): Date {
  const start = new Date(now.getTime())
  start.setHours(0, 0, 0, 0)
  // getDay(): 0 = Sunday. Shift so Monday is the first day.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

/** `YYYY-MM-DD` in local time (the form both APIs expect). */
export function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "streamdeck-weekly-metrics",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function githubSearchCount(
  path: string,
  query: string,
  config: MetricConfig,
): Promise<number> {
  const base = config.githubBase ?? GITHUB_BASE
  const fetchImpl = config.fetchImpl ?? defaultFetch
  const url = `${base}/search/${path}?q=${encodeURIComponent(query)}&per_page=1`
  const res = await fetchImpl(url, {
    headers: githubHeaders(config.githubToken),
  })
  if (!res.ok) {
    throw new Error(`GitHub search failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  return isRecord(body) && typeof body.total_count === "number"
    ? body.total_count
    : 0
}

/** Hours coded so far this week, via WakaTime summaries. */
export async function codingHours(config: MetricConfig): Promise<number> {
  const now = config.now ?? new Date()
  const base = config.wakatimeBase ?? WAKATIME_BASE
  const fetchImpl = config.fetchImpl ?? defaultFetch
  const key = config.wakatimeApiKey
  if (!key) {
    throw new Error("WAKATIME_API_KEY not set")
  }
  const url =
    `${base}/users/current/summaries` +
    `?start=${isoDate(weekStart(now))}&end=${isoDate(now)}`
  const res = await fetchImpl(url, {
    headers: {
      // WakaTime takes the raw API key as HTTP Basic username.
      Authorization: `Basic ${Buffer.from(key).toString("base64")}`,
      "User-Agent": "streamdeck-weekly-metrics",
    },
  })
  if (!res.ok) {
    throw new Error(`WakaTime failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!isRecord(body) || !isRecord(body.cumulative_total)) {
    return 0
  }
  const seconds = body.cumulative_total.seconds
  return typeof seconds === "number" ? seconds / 3600 : 0
}

/** Pull requests you merged since Monday. */
export function prsMerged(config: MetricConfig): Promise<number> {
  const since = isoDate(weekStart(config.now ?? new Date()))
  return githubSearchCount(
    "issues",
    `is:pr author:@me is:merged merged:>=${since}`,
    config,
  )
}

/** Commits you authored since Monday. */
export function commits(config: MetricConfig): Promise<number> {
  const login = config.githubLogin
  if (!login) {
    return Promise.reject(new Error("githubLogin not set"))
  }
  const since = isoDate(weekStart(config.now ?? new Date()))
  // Commit search has no `@me` shorthand, hence the explicit login.
  return githubSearchCount(
    "commits",
    `author:${login} author-date:>=${since}`,
    config,
  )
}

/** Meetings on your calendar since Monday. */
export async function meetings(config: MetricConfig): Promise<number> {
  const url = config.icalUrl
  if (!url) {
    throw new Error("ICAL_URL not set")
  }
  const fetchImpl = config.fetchImpl ?? defaultFetch
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "streamdeck-weekly-metrics" },
  })
  if (!res.ok) {
    throw new Error(`iCal fetch failed: HTTP ${res.status}`)
  }
  const now = config.now ?? new Date()
  const from = weekStart(now)
  const to = new Date(from.getTime())
  to.setDate(to.getDate() + 7)
  return countMeetings(await res.text(), from, to, {
    includeAllDay: config.includeAllDayMeetings,
  })
}

/** Exported so the failure path labels a key exactly like the success path. */
export const LABELS: Record<MetricKind, string> = {
  coding: "CODE",
  "prs-merged": "PRS",
  commits: "COMMITS",
  meetings: "MTGS",
}

/** Fetch one metric and format it for the key. */
export async function fetchMetric(
  kind: MetricKind,
  config: MetricConfig,
): Promise<Metric> {
  const label = LABELS[kind]
  switch (kind) {
    case "coding": {
      const hours = await codingHours(config)
      return { kind, label, value: `${hours.toFixed(1)}h` }
    }
    case "prs-merged":
      return { kind, label, value: String(await prsMerged(config)) }
    case "commits":
      return { kind, label, value: String(await commits(config)) }
    case "meetings":
      return { kind, label, value: String(await meetings(config)) }
  }
}

/** Step to the next metric in the cycle, wrapping at the end. */
export function nextKind(
  current: MetricKind,
  cycle: readonly MetricKind[],
): MetricKind {
  if (cycle.length === 0) {
    return current
  }
  const index = cycle.indexOf(current)
  return cycle[(index + 1) % cycle.length] ?? current
}
