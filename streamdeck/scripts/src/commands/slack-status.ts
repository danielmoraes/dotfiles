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

  const payload = JSON.stringify(slackStatusPayload(preset.emoji, preset.text))
  // The token goes in via a stdin config file rather than argv: anything on the
  // command line is readable by every other process on the machine through `ps`.
  // `--max-time` keeps a stalled connection from leaving the key hanging with
  // no notification either way.
  const result = await ctx.shell.run(
    "curl",
    [
      "-s",
      "--max-time",
      "10",
      "-X",
      "POST",
      "https://slack.com/api/users.profile.set",
      "-H",
      "Content-type: application/json; charset=utf-8",
      "--data",
      payload,
      "--config",
      "-",
    ],
    { input: `header = "Authorization: Bearer ${token}"\n` },
  )
  if (result.code !== 0) {
    await ctx.notify("Slack status", "Failed to reach Slack")
    return
  }

  // Slack answers 200 even when it refuses the call, putting the outcome in the
  // body as `{"ok":false,"error":"invalid_auth"}` — so curl exiting 0 says only
  // that the request left the machine. Without this the key would flash
  // "🟢 Available" while the status never changed.
  const error = slackError(result.stdout)
  if (error) {
    ctx.log(`Slack rejected the status update: ${error}`)
    await ctx.notify("Slack status", `Slack error: ${error}`)
    return
  }

  await ctx.fs.writeFile(stateFile, `${preset.name}\n`)
  await ctx.notify("Slack status", preset.label)
}
