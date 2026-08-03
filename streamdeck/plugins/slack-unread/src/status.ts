/**
 * Reading the Slack status back, so a key can show what it actually is rather
 * than what it last set.
 *
 * Status is readable with `users.profile:read`. **Presence is not** — that
 * needs `users:read`, a scope this token doesn't carry — so "away" can't be
 * confirmed from the API and the caller supplies its own record of it.
 */

export type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<FetchResponse>

export type Profile = { emoji: string; text: string }

const DEFAULT_BASE = "https://slack.com/api"
const FETCH_TIMEOUT_MS = 10_000

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { ok: res.ok, status: res.status, json: () => res.json() }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export type ProfileOptions = {
  token?: string
  apiBase?: string
  fetchImpl?: FetchLike
}

/** The signed-in user's current status emoji and text. */
export async function currentProfile(
  opts: ProfileOptions = {},
): Promise<Profile> {
  if (!opts.token) {
    throw new Error("SLACK_TOKEN not set")
  }
  const base = opts.apiBase ?? DEFAULT_BASE
  const res = await (opts.fetchImpl ?? defaultFetch)(
    `${base}/users.profile.get`,
    {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "User-Agent": "streamdeck-slack-status",
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Slack users.profile.get failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!isRecord(body) || body.ok !== true) {
    const reason =
      isRecord(body) && typeof body.error === "string" ? body.error : "unknown"
    throw new Error(`Slack users.profile.get failed: ${reason}`)
  }
  const profile = isRecord(body.profile) ? body.profile : {}
  return { emoji: str(profile.status_emoji), text: str(profile.status_text) }
}

/**
 * Label for the key, given the live status and our own record of the mode.
 *
 * The local record only wins for `away`: presence isn't readable, so a status
 * that matches nothing we set is more likely a hand-set one than a stale
 * record — and showing what Slack actually says beats showing what we hoped.
 */
export function statusLabel(
  profile: Profile,
  known: readonly {
    name: string
    emoji: string
    text: string
    keyLabel: string
  }[],
  localMode = "",
): string {
  const match = known.find(
    (p) =>
      (p.emoji !== "" && p.emoji === profile.emoji) ||
      (p.text !== "" && p.text === profile.text),
  )
  if (match) {
    return match.keyLabel
  }
  if (profile.emoji === "" && profile.text === "") {
    // Nothing set in Slack. Only our own record can tell online from away.
    const away = known.find((p) => p.name === localMode && p.name === "away")
    return away
      ? away.keyLabel
      : (known.find((p) => p.name === "clear")?.keyLabel ?? "Online")
  }
  // Something set by hand — show it rather than pretend it's one of ours.
  return profile.text.slice(0, 8) || "set"
}
