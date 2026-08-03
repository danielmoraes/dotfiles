import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
import { stateDir, statePath } from "../lib/state"
import {
  type StatusPreset,
  PRESETS,
  nextPreset,
  presetByName,
  slackError,
  slackStatusPayload,
} from "../lib/slack"

/**
 * Set your Slack status from a key.
 *
 * With no argument it cycles the presets (available → focus → lunch → clear),
 * so a single key covers the whole set; pass a preset name to jump straight to
 * one. The active preset is kept in a state file next to the other mode
 * commands' so the cycle survives between presses.
 */
/** Slack's scope errors, translated into the fix rather than the symptom. */
const SCOPE_HINTS: Record<string, string> = {
  missing_scope: "needs a scope — see the plugin README",
  not_allowed_token_type: "wrong token type",
  invalid_auth: "token rejected",
}

export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const stateFile = statePath("slack-status", ctx.home)

  const requested = args[0]
  let preset: StatusPreset | undefined
  if (requested) {
    preset = presetByName(requested)
    if (!preset) {
      const names = PRESETS.map((p) => p.name).join(", ")
      ctx.log(`Unknown preset "${requested}". Expected one of: ${names}`)
      return
    }
  } else {
    const current = (await ctx.fs.exists(stateFile))
      ? (await ctx.fs.readFile(stateFile)).trim()
      : ""
    preset = nextPreset(current)
  }

  const token = ctx.env.SLACK_TOKEN
  if (!token) {
    ctx.log("SLACK_TOKEN not set — see ~/.config/streamdeck/secrets.env")
    await ctx.notify("Slack status", "SLACK_TOKEN not set")
    return
  }

  /** POST to a Slack method with the token supplied over stdin, not argv. */
  const post = async (
    method: string,
    body: string,
    contentType = "application/json; charset=utf-8",
  ) =>
    ctx.shell.run(
      "curl",
      [
        "-s",
        "--max-time",
        "10",
        "-X",
        "POST",
        `https://slack.com/api/${method}`,
        "-H",
        `Content-type: ${contentType}`,
        "--data",
        body,
        "--config",
        "-",
      ],
      // Anything on the command line is readable by every other process on the
      // machine through `ps`; a stdin config keeps the token out of it.
      { input: `header = "Authorization: Bearer ${token}"\n` },
    )

  const status = await post(
    "users.profile.set",
    JSON.stringify(slackStatusPayload(preset.emoji, preset.text)),
  )
  if (status.code !== 0) {
    await ctx.notify("Slack status", "Failed to reach Slack")
    return
  }
  // Slack answers 200 even when it refuses the call, putting the outcome in the
  // body as `{"ok":false,"error":"invalid_auth"}` — so curl exiting 0 says only
  // that the request left the machine.
  const statusError = slackError(status.stdout)
  if (statusError) {
    ctx.log(`Slack rejected the status update: ${statusError}`)
    await ctx.notify("Slack status", `Slack error: ${statusError}`)
    return
  }

  /**
   * Apply one side-effect and collect a human-readable complaint if Slack
   * refuses. These are separate API calls behind separate scopes, so a mode can
   * half-apply — the status lands while the presence or the snooze doesn't. The
   * key must say so rather than claim the whole mode.
   */
  const problems: string[] = []
  const apply = async (
    what: string,
    method: string,
    body: string,
    contentType = "application/json; charset=utf-8",
  ): Promise<void> => {
    const res = await post(method, body, contentType)
    const failure = res.code === 0 ? slackError(res.stdout) : "unreachable"
    if (failure) {
      ctx.log(`Slack rejected the ${what} change: ${failure}`)
      problems.push(`${what}: ${SCOPE_HINTS[failure] ?? failure}`)
    }
  }

  await apply(
    "presence",
    "users.setPresence",
    JSON.stringify({ presence: preset.presence }),
  )

  // Snoozing is what actually silences Slack; the 🔕 emoji above only tells
  // people something. Ending a snooze is a different method, not zero minutes.
  if (preset.dndMinutes > 0) {
    await apply(
      "notifications",
      "dnd.setSnooze",
      `num_minutes=${preset.dndMinutes}`,
      "application/x-www-form-urlencoded",
    )
  } else {
    const res = await post("dnd.endSnooze", "{}")
    const failure = res.code === 0 ? slackError(res.stdout) : "unreachable"
    // `snooze_not_active` just means there was nothing to end.
    if (failure && failure !== "snooze_not_active") {
      ctx.log(`Slack rejected the notifications change: ${failure}`)
      problems.push(`notifications: ${SCOPE_HINTS[failure] ?? failure}`)
    }
  }

  // The mode is recorded even when part of it failed: the status did change,
  // and the cycle has to stay in step with what Slack now shows.
  await ctx.fs.mkdirp(stateDir(ctx.home))
  await ctx.fs.writeFile(stateFile, `${preset.name}\n`)
  await ctx.notify(
    "Slack status",
    problems.length > 0
      ? `${preset.label} — ${problems.join(", ")}`
      : preset.label,
  )
}
