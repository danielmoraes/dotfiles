import {
  type LocalEvent,
  formatCountdown,
  minutesUntil,
  nextEvent,
  shortTitle,
} from "streamdeck-ical"

/** What the key should show, decided without touching the Stream Deck SDK. */
export type KeyFace = {
  /** Key title, `\n`-separated across two lines. */
  title: string
  /** 0 = normal, 1 = imminent. */
  state: 0 | 1
}

export type FaceOptions = {
  /** Minutes at/under which the key flips to the imminent state. */
  warnMinutes?: number
  includeAllDay?: boolean
}

const DEFAULT_WARN_MINUTES = 10

/**
 * Pick the key face for the next meeting.
 *
 * Kept pure so the interesting decisions — which event wins, when the key turns
 * amber, what an empty calendar looks like — are testable without a device or
 * a calendar store.
 */
export function nextMeetingFace(
  events: readonly LocalEvent[],
  now: Date,
  opts: FaceOptions = {},
): KeyFace {
  const next = nextEvent(events, now, { includeAllDay: opts.includeAllDay })
  if (!next) {
    return { title: "clear", state: 0 }
  }
  const minutes = minutesUntil(next.start, now)
  return {
    title: `${shortTitle(next.title)}\n${formatCountdown(minutes)}`,
    state: minutes <= (opts.warnMinutes ?? DEFAULT_WARN_MINUTES) ? 1 : 0,
  }
}
