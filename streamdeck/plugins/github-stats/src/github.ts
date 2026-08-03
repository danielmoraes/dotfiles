/**
 * Pure GitHub data helpers. No Stream Deck dependencies so they can be unit
 * tested with an injected `fetchImpl`. Works against github.com or a GitHub
 * Enterprise / mock base URL.
 */

export type Conclusion = "success" | "failure" | "pending" | "unknown"

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

export type GitHubOptions = {
  /** API base, no trailing slash. Defaults to https://api.github.com. */
  apiBase?: string
  token?: string
  fetchImpl?: FetchLike
}

const DEFAULT_BASE = "https://api.github.com"

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init)
  return { ok: res.ok, status: res.status, json: () => res.json() }
}

function headers(token?: string): Record<string, string> {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "streamdeck-github-stats",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) {
    result.Authorization = `Bearer ${token}`
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Run a GitHub issue/PR search and return the total match count.
 * Example query: `is:open is:pr review-requested:@me`.
 */
export async function searchCount(
  query: string,
  opts: GitHubOptions = {},
): Promise<number> {
  const base = opts.apiBase ?? DEFAULT_BASE
  const fetchImpl = opts.fetchImpl ?? defaultFetch
  const url = `${base}/search/issues?q=${encodeURIComponent(query)}&per_page=1`
  const res = await fetchImpl(url, { headers: headers(opts.token) })
  if (!res.ok) {
    throw new Error(`GitHub search failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (isRecord(body) && typeof body.total_count === "number") {
    return body.total_count
  }
  return 0
}

/**
 * Return the conclusion of the most recent Actions run for a repo/branch.
 * `repo` is "owner/name".
 */
export async function latestRunConclusion(
  repo: string,
  branch: string,
  opts: GitHubOptions = {},
): Promise<Conclusion> {
  const base = opts.apiBase ?? DEFAULT_BASE
  const fetchImpl = opts.fetchImpl ?? defaultFetch
  const url = `${base}/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`
  const res = await fetchImpl(url, { headers: headers(opts.token) })
  if (!res.ok) {
    throw new Error(`GitHub runs failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!isRecord(body) || !Array.isArray(body.workflow_runs)) {
    return "unknown"
  }
  const run: unknown = body.workflow_runs[0]
  if (!isRecord(run)) {
    return "unknown"
  }
  if (run.status !== "completed") {
    return "pending"
  }
  return run.conclusion === "success" ? "success" : "failure"
}

/** Two-state key helper: 0 = ok/quiet, 1 = attention (count at/above threshold). */
export function countState(n: number, warnAt = 1): 0 | 1 {
  return n >= warnAt ? 1 : 0
}
