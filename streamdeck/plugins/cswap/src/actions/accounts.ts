import streamDeck, {
  SingletonAction,
  type DialDownEvent,
  type DialRotateEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { type Account, listAccounts, switchAccount } from "../cswap"
import {
  type Metric,
  METRICS,
  renderError,
  renderSvg,
  svgDataUri,
} from "../render"

export type AccountsSettings = {
  /** Seconds between reads of cswap. */
  refreshSeconds?: number
  /** Override the derived per-account label, keyed by email. */
  labels?: Record<string, string>
  /** How a press picks the next account; see `SwitchStrategy`. */
  strategy?: "rotate" | "best" | "next-available"
}

/**
 * cswap caches usage for about 30s and refreshes on demand, so polling faster
 * than that only costs process spawns without ever showing a newer number.
 */
const DEFAULT_REFRESH_SECONDS = 60
const MIN_REFRESH_SECONDS = 15

type Dial = WillAppearEvent<AccountsSettings>["action"]

/**
 * Every managed Claude account's usage on the touch strip, with the active one
 * marked. Rotate to change which window is shown; press to switch account.
 *
 * State is read back from cswap rather than tracked here — the same reason the
 * Slack status key re-reads Slack: an account switched in a terminal has to
 * show up on the deck, and a dial that trusts its own last write drifts.
 */
export class Accounts extends SingletonAction<AccountsSettings> {
  override manifestId = "com.dmoraes.cswap.accounts"

  private readonly timers = new Map<string, NodeJS.Timeout>()
  /** Which window each visible dial is showing, as an index into `METRICS`. */
  private readonly metrics = new Map<string, number>()
  /**
   * Last good read, per dial.
   *
   * Rotating only changes which number is drawn, not the data behind it, so it
   * repaints from here instead of spawning cswap on every tick.
   */
  private readonly cache = new Map<string, Account[]>()
  /** Dials with a switch in flight, so a double-press can't stack switches. */
  private readonly switching = new Set<string>()

  override async onWillAppear(
    ev: WillAppearEvent<AccountsSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.render(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<AccountsSettings>,
  ): Promise<void> {
    const timer = this.timers.get(ev.action.id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(ev.action.id)
    }
    this.cache.delete(ev.action.id)
    this.metrics.delete(ev.action.id)
    return Promise.resolve()
  }

  override async onDialRotate(
    ev: DialRotateEvent<AccountsSettings>,
  ): Promise<void> {
    const current = this.metrics.get(ev.action.id) ?? 0
    // One step per gesture, whichever way it was turned: the cycle is three
    // long, so honouring a fast flick's tick count would skip past windows.
    const step = ev.payload.ticks >= 0 ? 1 : -1
    const next = (current + step + METRICS.length) % METRICS.length
    this.metrics.set(ev.action.id, next)
    await this.paint(ev.action, ev.payload.settings)
  }

  override async onDialDown(
    ev: DialDownEvent<AccountsSettings>,
  ): Promise<void> {
    if (this.switching.has(ev.action.id)) {
      return
    }
    this.switching.add(ev.action.id)
    try {
      switchAccount(ev.payload.settings.strategy ?? "rotate")
    } catch (error) {
      streamDeck.logger.error(
        `cswap switch failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      await ev.action.showAlert()
    } finally {
      this.switching.delete(ev.action.id)
    }
    // Read back rather than assume the switch landed where it was aimed.
    await this.render(ev.action, ev.payload.settings)
  }

  private schedule(action: Dial, settings: AccountsSettings): void {
    const existing = this.timers.get(action.id)
    if (existing) {
      clearInterval(existing)
    }
    const seconds = Math.max(
      settings.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
      MIN_REFRESH_SECONDS,
    )
    const timer = setInterval(() => {
      void this.render(action, settings)
    }, seconds * 1_000)
    // Don't hold the plugin process open just for the poll loop.
    timer.unref?.()
    this.timers.set(action.id, timer)
  }

  /** Re-read cswap, then repaint. */
  private async render(
    action: Dial,
    settings: AccountsSettings,
  ): Promise<void> {
    try {
      this.cache.set(action.id, listAccounts())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      streamDeck.logger.error(`cswap read failed: ${message}`)
      this.cache.delete(action.id)
      await this.feedback(action, renderError(message))
      return
    }
    await this.paint(action, settings)
  }

  /** Repaint from the last good read, without touching cswap. */
  private async paint(action: Dial, settings: AccountsSettings): Promise<void> {
    const accounts = this.cache.get(action.id)
    if (!accounts) {
      return
    }
    const metric: Metric =
      METRICS[this.metrics.get(action.id) ?? 0] ?? METRICS[0]
    await this.feedback(
      action,
      renderSvg(accounts, metric, { labels: settings.labels }),
    )
  }

  private async feedback(action: Dial, svg: string): Promise<void> {
    if (!("setFeedback" in action)) {
      // The manifest declares this action Encoder-only, so a keypad instance
      // shouldn't exist — but the SDK's action type covers both.
      return
    }
    await action.setFeedback({ canvas: svgDataUri(svg) })
  }
}
