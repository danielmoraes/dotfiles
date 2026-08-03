import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { countState, selectCount, unreadCounts } from "../slack"

export type UnreadCountSettings = {
  /** User OAuth token (`xoxp-`); falls back to SLACK_TOKEN for local dev. */
  token?: string
  /** Override API base (testing). */
  apiBase?: string
  /** Count at/above which the key flips to the "attention" state. */
  warnAt?: number
  /** Seconds between refreshes. Slack's rate limit is generous; 60s is plenty. */
  refreshSeconds?: number
  /** URL opened on key press. Defaults to the Slack desktop app. */
  openUrl?: string
  /** Which unread buckets to add up. All off = the combined total. */
  countDms?: boolean
  countMentions?: boolean
  countThreads?: boolean
}

const DEFAULT_REFRESH_SECONDS = 60
const DEFAULT_OPEN_URL = "slack://open"

/**
 * Unread Slack mentions/DMs on a key, polled on a timer.
 *
 * Unlike the GitHub keys — which can refresh on appear/press because their
 * counts move slowly — Slack unreads are the thing you want to glance at, so
 * this polls in the background and keeps the key live.
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
      15,
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
    const token = settings.token || process.env.SLACK_TOKEN
    if (!token) {
      await action.setTitle("no\ntoken")
      return
    }
    try {
      const unread = await unreadCounts({
        apiBase: settings.apiBase,
        token,
      })
      const n = selectCount(unread, {
        dms: settings.countDms,
        mentions: settings.countMentions,
        threads: settings.countThreads,
      })
      await action.setTitle(String(n))
      // setState only applies to keys; guard for dials/other controls.
      if ("setState" in action) {
        await action.setState(countState(n, settings.warnAt ?? 1))
      }
    } catch {
      await action.setTitle("!")
    }
  }
}
