import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { currentProfile, statusLabel } from "../status"

export type SlackStatusSettings = {
  /** Seconds between reads of the live status. */
  refreshSeconds?: number
  token?: string
}

const DEFAULT_REFRESH_SECONDS = 60
const COMMAND = join(homedir(), ".local", "bin", "sd-slack-status")
// Must match `scripts/src/lib/state.ts` — see there for why not $TMPDIR.
const STATE_FILE = join(
  homedir(),
  ".local",
  "state",
  "streamdeck",
  "slack-status",
)

/**
 * The modes the key cycles through, mirroring `scripts/src/lib/slack.ts`.
 *
 * Duplicated deliberately rather than imported: the scripts package builds to
 * standalone executables and isn't a library, and this is three lines of data
 * that changes about once a year. The shared thing is the command itself.
 */
const MODES = [
  { name: "clear", emoji: "", text: "", keyLabel: "Online" },
  {
    name: "focus",
    emoji: ":no_bell:",
    text: "Focusing — back later",
    keyLabel: "Focus",
  },
  // Away sets presence only, so its status is empty — indistinguishable
  // from `clear` via the API, which is why `statusLabel` takes a local record.
  { name: "away", emoji: "", text: "", keyLabel: "Away" },
]

/**
 * Shows your current Slack status, and cycles it on press.
 *
 * Reads the status back from Slack rather than trusting what it last set, so a
 * status changed in the Slack client shows up here too.
 */
export class SlackStatus extends SingletonAction<SlackStatusSettings> {
  override manifestId = "com.dmoraes.slack-unread.status"

  private readonly timers = new Map<string, NodeJS.Timeout>()

  override async onWillAppear(
    ev: WillAppearEvent<SlackStatusSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.render(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<SlackStatusSettings>,
  ): Promise<void> {
    const timer = this.timers.get(ev.action.id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(ev.action.id)
    }
    return Promise.resolve()
  }

  override async onKeyDown(
    ev: KeyDownEvent<SlackStatusSettings>,
  ): Promise<void> {
    try {
      // The command owns the cycle and the presence call; this key is its face.
      execFileSync(COMMAND, [], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
      })
    } catch (error) {
      streamDeck.logger.error(
        `sd-slack-status failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      await ev.action.showAlert()
    }
    // Slack needs a moment to reflect the change before it reads back.
    await new Promise((resolve) => setTimeout(resolve, 900))
    await this.render(ev.action, ev.payload.settings)
  }

  private schedule(
    action: WillAppearEvent<SlackStatusSettings>["action"],
    settings: SlackStatusSettings,
  ): void {
    const existing = this.timers.get(action.id)
    if (existing) {
      clearInterval(existing)
    }
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

  private localMode(): string {
    try {
      return execFileSync("/bin/cat", [STATE_FILE], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    } catch {
      return ""
    }
  }

  private async render(
    action: WillAppearEvent<SlackStatusSettings>["action"],
    settings: SlackStatusSettings,
  ): Promise<void> {
    try {
      const profile = await currentProfile({
        token: settings.token || process.env.SLACK_TOKEN,
      })
      await action.setTitle(statusLabel(profile, MODES, this.localMode()))
    } catch (error) {
      streamDeck.logger.error(
        `slack status failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      await action.setTitle("!")
    }
  }
}
