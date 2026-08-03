/**
 * Pure Jira helpers. No Stream Deck dependencies, so they can be unit tested
 * with an injected `fetchImpl`.
 */

export type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/** Minimal fetch shape so tests can inject a mock without DOM lib types. */
export type FetchLike = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
  },
) => Promise<FetchResponse>

export type JiraOptions = {
  /** Site host or URL, e.g. `formfactory.atlassian.net`. */
  baseUrl?: string
  email?: string
  apiToken?: string
  fetchImpl?: FetchLike
}

/**
 * Normalise a site to a usable origin.
 *
 * `JIRA_BASE_URL` is commonly written host-only (`formfactory.atlassian.net`),
 * which sends every request to a `301` and then fails to parse as JSON — an
 * unhelpful way to learn about a missing scheme. A trailing slash would
 * likewise produce `//rest/...`.
 */
export function normalizeBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (trimmed === "") {
    throw new Error("JIRA_BASE_URL not set")
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** HTTP Basic, the scheme Jira Cloud wants for an email + API token. */
function authHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const FETCH_TIMEOUT_MS = 15_000

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { ok: res.ok, status: res.status, json: () => res.json() }
}

/**
 * How many issues a JQL query matches.
 *
 * Uses `/rest/api/3/search/approximate-count`. The obvious alternative,
 * `/rest/api/3/search`, was **removed** by Atlassian and now answers `410`; its
 * replacement `/search/jql` returns token-paginated issues with no total at
 * all, so a plain count has to come from this endpoint.
 *
 * "Approximate" is Atlassian's word — for large result sets it's an estimate,
 * which is fine for a key that exists to say "roughly how much is on me".
 */
export async function jqlCount(
  jql: string,
  opts: JiraOptions = {},
): Promise<number> {
  const { baseUrl, email, apiToken } = opts
  if (!email || !apiToken) {
    throw new Error("JIRA_EMAIL / JIRA_API_TOKEN not set")
  }
  const base = normalizeBase(baseUrl ?? "")
  const fetchImpl = opts.fetchImpl ?? defaultFetch
  const res = await fetchImpl(`${base}/rest/api/3/search/approximate-count`, {
    method: "POST",
    headers: {
      Authorization: authHeader(email, apiToken),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ jql }),
  })
  const body = await res.json()
  if (!res.ok) {
    const message =
      isRecord(body) && Array.isArray(body.errorMessages)
        ? String(body.errorMessages[0] ?? "")
        : ""
    throw new Error(
      `Jira failed: HTTP ${res.status}${message ? ` — ${message}` : ""}`,
    )
  }
  return isRecord(body) && typeof body.count === "number" ? body.count : 0
}

/** The Jira UI URL for a JQL query, for opening on press. */
export function issueNavigatorUrl(baseUrl: string, jql: string): string {
  return `${normalizeBase(baseUrl)}/issues/?jql=${encodeURIComponent(jql)}`
}

/** Two-state key helper: 0 = quiet, 1 = attention (count at/above threshold). */
export function countState(n: number, warnAt = 1): 0 | 1 {
  return n >= warnAt ? 1 : 0
}
