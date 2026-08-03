/**
 * A Slack "mode" the deck can set with one key.
 *
 * Presence and status are separate things in Slack, and the useful modes need
 * both: "away" is a presence, "focusing" is a status, and clearing means
 * putting each back to its default. Modelling only status would leave you
 * showing as online with a Lunch message — visible, but still gettable.
 */
export type StatusPreset = {
  /** Stable id, used as the CLI argument and in the cycle state file. */
  name: string
  /** Shown in the macOS notification after setting. */
  label: string
  /** Short form for a deck key — two lines of ~8 characters. */
  keyLabel: string
  emoji: string
  text: string
  /** `auto` lets Slack decide from activity; `away` forces the away dot. */
  presence: "auto" | "away"
  /**
   * Minutes to snooze notifications for, or 0 to end any active snooze.
   *
   * A 🔕 status emoji is decoration — it tells colleagues something and mutes
   * nothing. Actually silencing Slack is `dnd.setSnooze`, a separate call and a
   * separate scope, and without it a "Focusing" key is purely cosmetic.
   */
  dndMinutes: number
}

/**
 * The cycle a bare `sd-slack-status` press walks through.
 *
 * Three states, not four: an empty status *is* "online and available", so a
 * separate Available preset only added a step that looked different in Slack
 * while meaning the same thing.
 */
export const PRESETS: readonly [StatusPreset, ...StatusPreset[]] = [
  {
    name: "clear",
    label: "Online",
    keyLabel: "Online",
    emoji: "",
    text: "",
    presence: "auto",
    dndMinutes: 0,
  },
  {
    name: "focus",
    label: "🔴 Focusing",
    keyLabel: "Focus",
    emoji: ":no_bell:",
    text: "Focusing — back later",
    presence: "auto",
    // Long enough to cover a deep-work block; ending it is one more press.
    dndMinutes: 90,
  },
  {
    // No status text: away is a *presence*, and a message alongside it just
    // adds noise to a colleague's sidebar for something the away dot already
    // says. It does mean an empty status can't be told apart from `clear` by
    // the API — see `presetFromStatus`.
    name: "away",
    label: "🌙 Away",
    keyLabel: "Away",
    emoji: "",
    text: "",
    presence: "away",
    // Stepping out isn't the same as heads-down: leave notifications alone so
    // they still reach the phone.
    dndMinutes: 0,
  },
]

/** Look up a preset by name; undefined if it isn't one of ours. */
export function presetByName(name: string): StatusPreset | undefined {
  return PRESETS.find((preset) => preset.name === name)
}

/**
 * The preset after `current` in the cycle, wrapping at the end.
 *
 * An unknown or empty `current` — a first press, or a status set by hand in
 * Slack — advances to `focus` rather than `clear`. Falling to `clear` would be
 * the arithmetic answer but a useless one: you'd press the key and watch
 * nothing happen, because "no status" is what you already had.
 */
export function nextPreset(current: string): StatusPreset {
  const index = PRESETS.findIndex((preset) => preset.name === current)
  if (index === -1) {
    return presetByName("focus") ?? PRESETS[0]
  }
  return PRESETS[(index + 1) % PRESETS.length] ?? PRESETS[0]
}

/**
 * Which preset a live Slack profile looks like.
 *
 * Status alone can't distinguish `clear` from `away` — both leave it empty, and
 * presence needs the `users:read` scope to read back. An empty status resolves
 * to `clear`; callers that care fall back to their own record of the mode.
 */
export function presetFromStatus(
  emoji: string,
  text: string,
): StatusPreset | undefined {
  if (emoji === "" && text === "") {
    return presetByName("clear")
  }
  return PRESETS.find(
    (preset) =>
      preset.emoji === emoji || (preset.text !== "" && preset.text === text),
  )
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
