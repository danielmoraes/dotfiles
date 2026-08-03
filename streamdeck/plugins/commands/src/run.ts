/**
 * Running a repo command from a key, without a terminal.
 *
 * The obvious wiring — Elgato's **Open** action pointed at `~/.local/bin/sd-*`
 * — does `open <path>`, and macOS hands a extension-less shell script to
 * whatever app claims that type. In practice that's your terminal, so pressing
 * the key spawned a Ghostty window instead of running anything. These commands
 * are meant to be invisible: set a Slack status, toggle Focus, copy a standup
 * summary to the clipboard.
 *
 * So the plugin executes them itself and reports the outcome on the key.
 */

/** Result of running a command, in the form the key needs to render it. */
export type RunOutcome = {
  ok: boolean
  /** Trimmed first line of output, if the command said anything. */
  message: string
}

/** How the action shells out; injectable so the decisions stay testable. */
export type Exec = (
  command: string,
  args: readonly string[],
) => { status: number; stdout: string; stderr: string }

/**
 * Interpret a command's exit into something a key can show.
 *
 * These commands report trouble on **stdout/stderr while still exiting 0** —
 * `sd-slack-status` prints "Slack rejected the status update: invalid_auth" and
 * exits cleanly, because it handled the error rather than crashing. Treating
 * exit code alone as success would paint a tick over a failure, which is the
 * exact bug that made the Slack key look like it worked when it didn't.
 */
export function interpret(
  status: number,
  stdout: string,
  stderr: string,
): RunOutcome {
  const said = `${stdout}\n${stderr}`
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
  const first = said[0] ?? ""

  if (status !== 0) {
    return { ok: false, message: first || `exit ${status}` }
  }
  // A command that stayed silent did its job; anything it chose to say on a
  // clean exit is a problem it handled and wants surfaced.
  return { ok: first === "", message: first }
}

/** Short label for a key after a run: a tick, or a clue about what went wrong. */
export function outcomeTitle(outcome: RunOutcome, fallback: string): string {
  if (outcome.ok) {
    return `${fallback}\n✓`
  }
  const word = outcome.message.split(/[\s:]+/).find((w) => w.length > 2)
  return `${fallback}\n${word ? word.slice(0, 8) : "✗"}`
}
