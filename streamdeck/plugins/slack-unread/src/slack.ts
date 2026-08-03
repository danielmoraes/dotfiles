/**
 * Pure Slack data helpers. No Stream Deck dependencies so they can be unit
 * tested with an injected `fetchImpl`.
 */

export type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/** Minimal fetch shape so tests can inject a mock without DOM lib types. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>

export type SlackOptions = {
  /** API base, no trailing slash. Defaults to https://slack.com/api. */
  apiBase?: string
  token?: string
  fetchImpl?: FetchLike
}

/** Unread work, split by where it came from. */
export type Unread = {
  /** Unread direct messages. */
  dms: number
  /** @-mentions in channels, private channels and group DMs. */
  mentions: number
  /** Unread replies in threads you follow. */
  threads: number
  /** Everything above — what the key shows by default. */
  total: number
}

const DEFAULT_BASE = "https://slack.com/api"

/**
 * Requests are bounded: a hung connection would otherwise leave the key blank
 * forever — `render` awaits this, so not even the `!` error state would paint.
 */
const FETCH_TIMEOUT_MS = 10_000

const defaultFetch: FetchLike = async (url, init) => {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const res = await fetch(url, { ...init, signal })
  return { ok: res.ok, status: res.status, json: () => res.json() }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Read a numeric field, treating anything non-numeric as 0. */
function num(source: unknown, key: string): number {
  if (!isRecord(source)) {
    return 0
  }
  const value = source[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Sum `key` across a list of conversation entries. */
function sumBy(list: unknown, key: string): number {
  if (!Array.isArray(list)) {
    return 0
  }
  return list.reduce<number>((total, entry) => total + num(entry, key), 0)
}

/**
 * Fetch unread counts via `users.counts`.
 *
 * This is the endpoint Slack's own clients use for the badge, and the only one
 * that returns per-conversation unread state in a single request — the public
 * `conversations.*` methods would need one call per conversation. It needs a
 * **user** token (`xoxp-`), not a bot token.
 */
export async function unreadCounts(opts: SlackOptions = {}): Promise<Unread> {
  const base = opts.apiBase ?? DEFAULT_BASE
  const fetchImpl = opts.fetchImpl ?? defaultFetch
  const res = await fetchImpl(`${base}/users.counts?mpim_aware=true`, {
    headers: {
      Authorization: `Bearer ${opts.token ?? ""}`,
      "User-Agent": "streamdeck-slack-unread",
    },
  })
  if (!res.ok) {
    throw new Error(`Slack users.counts failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!isRecord(body) || body.ok !== true) {
    // Slack signals failure in the body with `ok: false` and an `error` slug.
    const reason =
      isRecord(body) && typeof body.error === "string" ? body.error : "unknown"
    throw new Error(`Slack users.counts failed: ${reason}`)
  }

  // `ims` carry a whole-conversation unread count (every DM is "for you");
  // channels only count explicit @-mentions, which is what's worth a key.
  const dms = sumBy(body.ims, "dm_count")
  const mentions =
    sumBy(body.channels, "mention_count") +
    sumBy(body.groups, "mention_count") +
    sumBy(body.mpims, "mention_count")
  const threads = num(body.threads, "mention_count")

  return { dms, mentions, threads, total: dms + mentions + threads }
}

/** Which parts of `Unread` a key should add up. */
export type UnreadParts = {
  dms?: boolean
  mentions?: boolean
  threads?: boolean
}

/** Sum the enabled parts; with nothing selected, fall back to the total. */
export function selectCount(unread: Unread, parts: UnreadParts = {}): number {
  const anySelected =
    parts.dms === true || parts.mentions === true || parts.threads === true
  if (!anySelected) {
    return unread.total
  }
  return (
    (parts.dms === true ? unread.dms : 0) +
    (parts.mentions === true ? unread.mentions : 0) +
    (parts.threads === true ? unread.threads : 0)
  )
}

/** Two-state key helper: 0 = quiet, 1 = attention (count at/above threshold). */
export function countState(n: number, warnAt = 1): 0 | 1 {
  return n >= warnAt ? 1 : 0
}
