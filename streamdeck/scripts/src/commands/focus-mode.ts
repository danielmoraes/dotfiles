import type { Ctx } from "../lib/ctx"
import { stateDir, statePath } from "../lib/state"
import { runShortcut } from "../lib/shortcuts"
import { slackStatusPayload } from "../lib/slack"

/**
 * Toggle a "deep work" focus mode: macOS Focus (via a "Focus On"/"Focus Off"
 * Shortcut) and Slack status. Toggles off on a second run using a state file.
 *
 * It used to start a Spotify playlist too, off `STREAMDECK_FOCUS_PLAYLIST`.
 * That went with Spotify: `tell application "Spotify"` *launches* the app when
 * it isn't running, so on a Mac without it the key either opened an app you
 * don't use or failed outright. Nothing replaced it — starting the music is one
 * press in whichever player you actually use.
 */
export async function run(ctx: Ctx, _args: string[]): Promise<void> {
  const stateFile = statePath("focus", ctx.home)
  if (await ctx.fs.exists(stateFile)) {
    await focusOff(ctx, stateFile)
  } else {
    await focusOn(ctx, stateFile)
  }
}

async function focusOn(ctx: Ctx, stateFile: string): Promise<void> {
  await runShortcut(ctx, "Focus On", "Focus")
  await setSlackStatus(ctx, ":no_bell:", "Focusing — back later")
  await ctx.fs.mkdirp(stateDir(ctx.home))
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
  // Token via a stdin config file, not argv — see the same call in
  // commands/slack-status.ts.
  await ctx.shell.run(
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
}
