/**
 * Reading the Slack status back, so a key can show what it actually is rather
 * than what it last set.
 *
 * Both halves come from Slack: status via `users.profile:read`, presence via
 * `users:read`. That matters because "away" carries no status text — from the
 * profile alone it is byte-identical to "online". An earlier version inferred
 * it from a local record of the last press, which drifted the moment Slack
 * flipped you back to active on any interaction, and nothing could detect it.
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

/** `active` or `away`, as Slack reports it. */
export type Presence = "active" | "away"

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

/** Read the signed-in user's presence. Needs the `users:read` scope. */
export async function currentPresence(
  opts: ProfileOptions = {},
): Promise<Presence> {
  if (!opts.token) {
    throw new Error("SLACK_TOKEN not set")
  }
  const base = opts.apiBase ?? DEFAULT_BASE
  const res = await (opts.fetchImpl ?? defaultFetch)(
    `${base}/users.getPresence`,
    {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "User-Agent": "streamdeck-slack-status",
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Slack users.getPresence failed: HTTP ${res.status}`)
  }
  const body = await res.json()
  if (!isRecord(body) || body.ok !== true) {
    const reason =
      isRecord(body) && typeof body.error === "string" ? body.error : "unknown"
    throw new Error(`Slack users.getPresence failed: ${reason}`)
  }
  return body.presence === "away" ? "away" : "active"
}

/**
 * Label for the key, from what Slack currently reports.
 *
 * Presence is checked first: being away is the more consequential fact, and
 * the one a status string can't express — Slack shows you as away whatever
 * your status says.
 */
export function statusLabel(
  profile: Profile,
  presence: Presence,
  known: readonly {
    name: string
    emoji: string
    text: string
    keyLabel: string
  }[],
): string {
  if (presence === "away") {
    return known.find((p) => p.name === "away")?.keyLabel ?? "Away"
  }
  const match = known.find(
    (p) =>
      (p.emoji !== "" && p.emoji === profile.emoji) ||
      (p.text !== "" && p.text === profile.text),
  )
  if (match) {
    return match.keyLabel
  }
  if (profile.emoji === "" && profile.text === "") {
    return known.find((p) => p.name === "clear")?.keyLabel ?? "Online"
  }
  // Something set by hand — show it rather than pretend it's one of ours.
  return profile.text.slice(0, 8) || "set"
}
