import {
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { Context, DEFAULT_WINDOW } from "../context"
import { Sessions } from "../local"
import { renderEmpty, renderSlot, svgDataUri } from "../render"
import { toSlot } from "../session"

export type SlotSettings = {
  /**
   * Context window the bar is a proportion of, in tokens.
   *
   * There is no way to read this from disk — Claude Code hands the real
   * `context_window_size` to the status line on stdin and persists it nowhere,
   * and the model id in the transcript is `claude-opus-5` whether the session
   * is the 200k or the 1M variant. So it's declared, defaulting to the same
   * 200 000 Claude Code itself falls back to.
   */
  contextWindow?: number
  /** Where the session records live. Overridden only by the e2e test. */
  sessionsDir?: string
  /** Where the transcripts live. Overridden only by the e2e test. */
  projectsDir?: string
}

/**
 * Repaint interval while something is animating — 10fps reads as motion.
 *
 * The underlying reads are cached well below this (the session directory for a
 * second, transcripts for five), so a frame is almost always pure rendering.
 */
const FRAME_MS = 100
/**
 * Repaint interval when every session is idle.
 *
 * Nothing is moving, so the only reasons to repaint are the elapsed clocks and
 * noticing a session waking up — both of which a second serves. Holding 10fps
 * against seven static keys would be work with nothing to show for it.
 */
const RESTING_MS = 1_000

type Key = WillAppearEvent<SlotSettings>["action"]

type Placed = {
  action: Key
  device: string
  column: number
  row: number
}

/**
 * One live Claude Code session per key.
 *
 * Which session lands on which key is **positional**: the keys are sorted by
 * their coordinates and handed sessions oldest first. Nothing is stored per
 * key, so the profile binds the same action to all seven with no per-key
 * settings, and moving a key moves which session it watches.
 */
export class Slot extends SingletonAction<SlotSettings> {
  override manifestId = "com.dmoraes.sessions.slot"

  private readonly placed = new Map<string, Placed>()
  private sessions = new Sessions()
  private context = new Context()
  private contextWindow = DEFAULT_WINDOW
  private frame = 0
  private timer?: NodeJS.Timeout

  override async onWillAppear(
    ev: WillAppearEvent<SlotSettings>,
  ): Promise<void> {
    // A multi-action instance has no coordinates, and slots are positional —
    // there is no key for it to be, so it takes no session.
    if (
      !("coordinates" in ev.payload) ||
      ev.payload.coordinates === undefined
    ) {
      return
    }
    this.placed.set(ev.action.id, {
      action: ev.action,
      device: ev.action.device.id,
      column: ev.payload.coordinates.column,
      row: ev.payload.coordinates.row,
    })
    this.configure(ev.payload.settings)
    this.start()
    await this.paint()
  }

  override async onWillDisappear(
    ev: WillDisappearEvent<SlotSettings>,
  ): Promise<void> {
    this.placed.delete(ev.action.id)
    if (this.placed.size === 0) {
      this.stop()
      return
    }
    // The remaining keys shift up a slot when one disappears.
    await this.paint()
  }

  /**
   * Read on every appearance, not just the first: all the keys carry the same
   * settings, and a changed window should take effect without a restart.
   */
  private configure(settings: SlotSettings): void {
    const window = settings.contextWindow
    this.contextWindow =
      typeof window === "number" && window > 0 ? window : DEFAULT_WINDOW
    if (settings.sessionsDir !== undefined) {
      this.sessions = new Sessions(settings.sessionsDir)
    }
    if (settings.projectsDir !== undefined) {
      this.context = new Context(settings.projectsDir)
    }
  }

  /** Keys in reading order, per device: the slot order sessions fill. */
  private ordered(): Placed[] {
    return [...this.placed.values()].sort(
      (a, b) =>
        a.device.localeCompare(b.device) ||
        a.row - b.row ||
        a.column - b.column,
    )
  }

  /** Paints every key, and reports whether anything on screen is animating. */
  private async paint(): Promise<boolean> {
    const keys = this.ordered()
    const now = Date.now()
    const sessions = this.sessions.list(now)
    let animating = false

    await Promise.all(
      keys.map(async ({ action }, index) => {
        if (!("setImage" in action)) {
          // Manifest declares Keypad only, so this shouldn't happen — but the
          // SDK's action type covers dials too.
          return
        }
        const session = sessions[index]
        if (session === undefined) {
          await action.setImage(svgDataUri(renderEmpty()))
          return
        }
        const slot = toSlot(session, now, {
          terminal: this.sessions.terminal(session.pid),
          contextPercent: this.context.percent(
            session.sessionId,
            session.cwd,
            now,
            this.contextWindow,
          ),
        })
        if (slot.state !== "idle") {
          animating = true
        }
        await action.setImage(svgDataUri(renderSlot(slot, this.frame)))
      }),
    )
    return animating
  }

  /**
   * Self-scheduling repaint loop.
   *
   * `setTimeout` rather than `setInterval` so each pass can choose its own next
   * delay from what it just drew — full speed while a border is moving, a
   * second when nothing is.
   */
  private start(): void {
    if (this.timer) {
      return
    }
    const tick = (delay: number): void => {
      this.timer = setTimeout(() => {
        this.frame += 1
        void this.paint().then((animating) => {
          if (this.placed.size > 0) {
            tick(animating ? FRAME_MS : RESTING_MS)
          }
        })
      }, delay)
      // Don't hold the plugin process open just for the repaint loop.
      this.timer.unref?.()
    }
    tick(FRAME_MS)
  }

  private stop(): void {
    if (!this.timer) {
      return
    }
    clearTimeout(this.timer)
    this.timer = undefined
  }
}
