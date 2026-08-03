import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
import { runShortcut } from "../lib/shortcuts"
import { slackStatusPayload } from "../lib/slack"

/**
 * Toggle a "deep work" focus mode: macOS Focus (via a "Focus On"/"Focus Off"
 * Shortcut), Slack status, and an optional Spotify playlist. Toggles off on a
 * second run using a state file.
 */
export async function run(ctx: Ctx, _args: string[]): Promise<void> {
  const stateFile = join(ctx.env.TMPDIR ?? "/tmp", "streamdeck.focus.state")
  if (await ctx.fs.exists(stateFile)) {
    await focusOff(ctx, stateFile)
  } else {
    await focusOn(ctx, stateFile)
  }
}

async function focusOn(ctx: Ctx, stateFile: string): Promise<void> {
  await runShortcut(ctx, "Focus On", "Focus")
  await setSlackStatus(ctx, ":no_bell:", "Focusing — back later")
  const playlist = ctx.env.STREAMDECK_FOCUS_PLAYLIST
  if (playlist) {
    await ctx.shell.run("osascript", [
      "-e",
      `tell application "Spotify" to play track "${playlist}"`,
    ])
  }
  await ctx.fs.writeFile(stateFile, "on\n")
  await ctx.notify("Focus", "Deep work ON")
}

async function focusOff(ctx: Ctx, stateFile: string): Promise<void> {
  await runShortcut(ctx, "Focus Off", "Focus")
  await setSlackStatus(ctx, "", "")
  await ctx.fs.remove(stateFile)
  await ctx.notify("Focus", "Deep work OFF")
}

async function setSlackStatus(
  ctx: Ctx,
  emoji: string,
  text: string,
): Promise<void> {
  const token = ctx.env.SLACK_TOKEN
  if (!token) {
    return
  }
  const payload = JSON.stringify(slackStatusPayload(emoji, text))
  await ctx.shell.run("curl", [
    "-s",
    "-X",
    "POST",
    "https://slack.com/api/users.profile.set",
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "Content-type: application/json; charset=utf-8",
    "--data",
    payload,
  ])
}
