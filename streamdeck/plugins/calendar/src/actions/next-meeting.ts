import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { localEvents } from "streamdeck-ical"
import { nextMeetingFace } from "../render"

export type NextMeetingSettings = {
  /** Restrict to these calendar names; all calendars when omitted. */
  calendars?: string[]
  /** Minutes at/under which the key flips to the "imminent" state. */
  warnMinutes?: number
  /** Seconds between refreshes. */
  refreshSeconds?: number
  /** Opened on press. Defaults to Calendar.app. */
  openUrl?: string
  /** Count all-day banners as meetings (off: they're OOO/holidays). */
  includeAllDay?: boolean
}

const DEFAULT_REFRESH_SECONDS = 60
const DEFAULT_OPEN_URL = "ical://"

/**
 * The next meeting on the local macOS Calendar, as `TITLE` over a countdown.
 *
 * Reads Calendar.app's store rather than an `.ics` feed — a Workspace domain
 * can disable the per-calendar secret address, which leaves no private feed to
 * subscribe to, while the calendar itself is already synced to this Mac.
 */
export class NextMeeting extends SingletonAction<NextMeetingSettings> {
  override manifestId = "com.dmoraes.calendar.next-meeting"

  private readonly timers = new Map<string, NodeJS.Timeout>()

  override async onWillAppear(
    ev: WillAppearEvent<NextMeetingSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.render(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<NextMeetingSettings>,
  ): Promise<void> {
    this.clear(ev.action.id)
    return Promise.resolve()
  }

  override async onKeyDown(
    ev: KeyDownEvent<NextMeetingSettings>,
  ): Promise<void> {
    streamDeck.system.openUrl(ev.payload.settings.openUrl ?? DEFAULT_OPEN_URL)
    await this.render(ev.action, ev.payload.settings)
  }

  private schedule(
    action: WillAppearEvent<NextMeetingSettings>["action"],
    settings: NextMeetingSettings,
  ): void {
    this.clear(action.id)
    const seconds = Math.max(
      settings.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
      15,
    )
    const timer = setInterval(() => {
      void this.render(action, settings)
    }, seconds * 1_000)
    // Don't hold the plugin process open just for the poll loop.
    timer.unref?.()
    this.timers.set(action.id, timer)
  }

  private clear(actionId: string): void {
    const timer = this.timers.get(actionId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(actionId)
    }
  }

  private async render(
    action: WillAppearEvent<NextMeetingSettings>["action"],
    settings: NextMeetingSettings,
  ): Promise<void> {
    const now = new Date()
    try {
      // Look two days ahead: enough to roll past a quiet afternoon into
      // tomorrow's first meeting without reading the whole calendar.
      const horizon = new Date(now.getTime())
      horizon.setDate(horizon.getDate() + 2)
      const events = localEvents(now, horizon, {
        calendars: settings.calendars,
      })
      const face = nextMeetingFace(events, now, {
        warnMinutes: settings.warnMinutes,
        includeAllDay: settings.includeAllDay,
      })
      await action.setTitle(face.title)
      if ("setState" in action) {
        await action.setState(face.state)
      }
    } catch {
      await action.setTitle("cal\n!")
    }
  }
}
