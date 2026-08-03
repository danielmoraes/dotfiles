import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import {
  type UnreadMode,
  countState,
  formatTitle,
  selectCount,
  unreadCounts,
} from "../slack"

export type UnreadCountSettings = {
  /** `all` = Slack's own badge (DMs + mentions); `highlights` = mentions only. */
  mode?: string
  /** Restrict to these workspace/team ids; all workspaces when omitted. */
  teams?: string[]
  /** Count at/above which the key flips to the "attention" state. */
  warnAt?: number
  /** Seconds between refreshes. Reading a local file is cheap. */
  refreshSeconds?: number
  /** URL opened on key press. */
  openUrl?: string
  /** Override the Slack state file location (testing). */
  statePath?: string
}

const DEFAULT_REFRESH_SECONDS = 30
const DEFAULT_OPEN_URL = "slack://open"

function modeOf(settings: UnreadCountSettings): UnreadMode {
  return settings.mode === "highlights" ? "highlights" : "all"
}

/**
 * Unread Slack mentions/DMs on a key, read from the desktop app's own state.
 *
 * Polled rather than event-driven: the count is the thing you want to glance
 * at, and re-reading a small local JSON file every 30s costs nothing.
 */
export class UnreadCount extends SingletonAction<UnreadCountSettings> {
  override manifestId = "com.dmoraes.slack-unread.unread-count"

  /** One poll timer per visible key instance, keyed by action id. */
  private readonly timers = new Map<string, NodeJS.Timeout>()
  /** The post-press re-read, so it can be cancelled if the key goes away. */
  private readonly pending = new Map<string, NodeJS.Timeout>()

  override async onWillAppear(
    ev: WillAppearEvent<UnreadCountSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.refresh(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<UnreadCountSettings>,
  ): Promise<void> {
    this.clear(ev.action.id)
    return Promise.resolve()
  }

  override onKeyDown(ev: KeyDownEvent<UnreadCountSettings>): Promise<void> {
    streamDeck.system.openUrl(ev.payload.settings.openUrl ?? DEFAULT_OPEN_URL)
    // Opening Slack clears unreads; give it a beat before re-reading. Tracked
    // like the poll timer so a key that disappears inside those two seconds
    // doesn't leave a callback firing against a stale action.
    const existing = this.pending.get(ev.action.id)
    if (existing) {
      clearTimeout(existing)
    }
    const pending = setTimeout(() => {
      this.pending.delete(ev.action.id)
      void this.refresh(ev.action, ev.payload.settings)
    }, 2_000)
    pending.unref?.()
    this.pending.set(ev.action.id, pending)
    return Promise.resolve()
  }

  private schedule(
    action: WillAppearEvent<UnreadCountSettings>["action"],
    settings: UnreadCountSettings,
  ): void {
    this.clear(action.id)
    const seconds = Math.max(
      settings.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
      5,
    )
    const timer = setInterval(() => {
      void this.refresh(action, settings)
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
    const pending = this.pending.get(actionId)
    if (pending) {
      clearTimeout(pending)
      this.pending.delete(actionId)
    }
  }

  private async refresh(
    action: WillAppearEvent<UnreadCountSettings>["action"],
    settings: UnreadCountSettings,
  ): Promise<void> {
    try {
      const unread = unreadCounts({
        path: settings.statePath,
        teams: settings.teams,
      })
      const mode = modeOf(settings)
      await action.setTitle(formatTitle(unread, mode))
      // setState only applies to keys; guard for dials/other controls.
      if ("setState" in action) {
        await action.setState(
          countState(selectCount(unread, mode), settings.warnAt ?? 1),
        )
      }
    } catch {
      // Slack not installed, not yet run, or the state file changed shape.
      await action.setTitle("–")
    }
  }
}
