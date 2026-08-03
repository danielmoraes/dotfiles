import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
} from "@elgato/streamdeck"
import { type Exec, interpret, outcomeTitle } from "../run"

export type RunCommandSettings = {
  /** Command to run. A bare name resolves against ~/.local/bin. */
  command?: string
  args?: string[]
  /** Key label. The outcome is appended on the second line after a press. */
  title?: string
  /** Seconds the ✓/✗ stays up before the label returns. */
  feedbackSeconds?: number
}

const DEFAULT_FEEDBACK_SECONDS = 2
const BIN_DIR = join(homedir(), ".local", "bin")

const realExec: Exec = (command, args) => {
  try {
    const stdout = execFileSync(command, [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    // execFileSync attaches status/stdout/stderr to the thrown Error, but they
    // aren't on the Error type — read them off a record view instead.
    const e: Record<string, unknown> =
      typeof error === "object" && error !== null ? { ...error } : {}
    const str = (v: unknown): string => (typeof v === "string" ? v : "")
    const fallback = error instanceof Error ? error.message : ""
    return {
      status: typeof e.status === "number" ? e.status : 1,
      stdout: str(e.stdout),
      stderr: str(e.stderr) || fallback,
    }
  }
}

/**
 * Run one of the repo's `sd-*` commands on press, silently.
 *
 * Deliberately not Elgato's Open action: that shells out to `open`, which hands
 * an extension-less script to the user's terminal app instead of executing it.
 */
export class RunCommand extends SingletonAction<RunCommandSettings> {
  override manifestId = "com.dmoraes.commands.run"

  private readonly resets = new Map<string, NodeJS.Timeout>()

  override onWillAppear(
    ev: WillAppearEvent<RunCommandSettings>,
  ): Promise<void> {
    return ev.action.setTitle(ev.payload.settings.title ?? "")
  }

  override async onKeyDown(
    ev: KeyDownEvent<RunCommandSettings>,
  ): Promise<void> {
    const settings = ev.payload.settings
    const label = settings.title ?? ""
    const command = settings.command
    if (!command) {
      await ev.action.setTitle(`${label}\nunset`)
      return
    }
    // A bare name is resolved here rather than left to PATH: the Stream Deck
    // app runs under launchd, whose PATH is only /usr/bin:/bin:/usr/sbin:/sbin.
    const resolved = isAbsolute(command) ? command : join(BIN_DIR, command)

    const { status, stdout, stderr } = realExec(resolved, settings.args ?? [])
    const outcome = interpret(status, stdout, stderr)
    if (!outcome.ok) {
      streamDeck.logger.error(`${command} failed: ${outcome.message}`)
    }
    await ev.action.setTitle(outcomeTitle(outcome, label))
    await (outcome.ok ? ev.action.showOk() : ev.action.showAlert())

    // Put the plain label back so the key doesn't sit on stale feedback.
    const existing = this.resets.get(ev.action.id)
    if (existing) {
      clearTimeout(existing)
    }
    const timer = setTimeout(
      () => {
        this.resets.delete(ev.action.id)
        void ev.action.setTitle(label)
      },
      Math.max(settings.feedbackSeconds ?? DEFAULT_FEEDBACK_SECONDS, 1) * 1_000,
    )
    timer.unref?.()
    this.resets.set(ev.action.id, timer)
  }
}
