/** A named Slack status the deck can set with one key. */
export type StatusPreset = {
  /** Stable id, used as the CLI argument and in the cycle state file. */
  name: string
  /** Shown in the macOS notification after setting. */
  label: string
  emoji: string
  text: string
}

/**
 * The cycle a bare `sd-slack-status` press walks through. `clear` last so a
 * fourth press always gets you back to no status.
 */
// Typed as a non-empty tuple so `nextPreset` has a guaranteed fallback.
export const PRESETS: readonly [StatusPreset, ...StatusPreset[]] = [
  {
    name: "available",
    label: "🟢 Available",
    emoji: ":large_green_circle:",
    text: "Available",
  },
  {
    name: "focus",
    label: "🔴 Focusing",
    emoji: ":no_bell:",
    text: "Focusing — back later",
  },
  {
    name: "lunch",
    label: "🍽 Lunch",
    emoji: ":knife_fork_plate:",
    text: "Lunch",
  },
  { name: "clear", label: "Status cleared", emoji: "", text: "" },
]

/** Look up a preset by name; undefined if it isn't one of ours. */
export function presetByName(name: string): StatusPreset | undefined {
  return PRESETS.find((preset) => preset.name === name)
}

/**
 * The preset after `current` in the cycle, wrapping at the end. An unknown or
 * empty `current` (first press, or a hand-set status) starts from the top.
 */
export function nextPreset(current: string): StatusPreset {
  const index = PRESETS.findIndex((preset) => preset.name === current)
  return PRESETS[(index + 1) % PRESETS.length] ?? PRESETS[0]
}

/**
 * Read Slack's error slug out of an API response body.
 *
 * Returns undefined when the call succeeded. Slack replies 200 regardless, with
 * `{"ok":false,"error":"…"}` on failure, so the body is the only signal. An
 * unparseable body is reported rather than assumed fine — a proxy or captive
 * portal returning HTML shouldn't read as success.
 */
export function slackError(body: string): string | undefined {
  const trimmed = body.trim()
  if (trimmed === "") {
    return "empty response"
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return "unreadable response"
  }
  if (typeof parsed !== "object" || parsed === null) {
    return "unreadable response"
  }
  const record: Record<string, unknown> = { ...parsed }
  if (record.ok === true) {
    return undefined
  }
  return typeof record.error === "string" ? record.error : "unknown error"
}

/** Slack `users.profile.set` payload for a status (empty clears it). */
export function slackStatusPayload(
  emoji: string,
  text: string,
): {
  profile: {
    status_text: string
    status_emoji: string
    status_expiration: number
  }
} {
  return {
    profile: {
      status_text: text,
      status_emoji: emoji,
      status_expiration: 0,
    },
  }
}
