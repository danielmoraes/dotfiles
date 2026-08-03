import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
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
export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const stateFile = join(ctx.env.TMPDIR ?? "/tmp", "streamdeck.slack-status")

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
  const post = async (method: string, body: string) =>
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
        "Content-type: application/json; charset=utf-8",
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

  // Presence is a separate call, and a separate scope. Without `users:write`
  // this fails while the status above succeeds — report it rather than let the
  // key claim a mode it only half-applied.
  const presence = await post(
    "users.setPresence",
    JSON.stringify({ presence: preset.presence }),
  )
  const presenceError =
    presence.code === 0 ? slackError(presence.stdout) : "unreachable"
  if (presenceError) {
    const hint =
      presenceError === "missing_scope"
        ? "add the users:write scope"
        : presenceError
    ctx.log(`Slack rejected the presence change: ${presenceError}`)
    await ctx.notify("Slack status", `${preset.label} (presence: ${hint})`)
    await ctx.fs.writeFile(stateFile, `${preset.name}\n`)
    return
  }

  await ctx.fs.writeFile(stateFile, `${preset.name}\n`)
  await ctx.notify("Slack status", preset.label)
}
