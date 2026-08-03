import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
import { runShortcut } from "../lib/shortcuts"

/**
 * Toggle meeting mode: pause music and run a "Meeting On"/"Meeting Off" Shortcut
 * (Focus + mic mute). Toggles off on a second run using a state file.
 */
export async function run(ctx: Ctx, _args: string[]): Promise<void> {
  const stateFile = join(ctx.env.TMPDIR ?? "/tmp", "streamdeck.meeting.state")
  if (await ctx.fs.exists(stateFile)) {
    await runShortcut(ctx, "Meeting Off", "Meeting")
    await ctx.fs.remove(stateFile)
    await ctx.notify("Meeting", "Meeting mode OFF")
  } else {
    await ctx.shell.run("osascript", [
      "-e",
      'tell application "Spotify" to pause',
    ])
    await runShortcut(ctx, "Meeting On", "Meeting")
    await ctx.fs.writeFile(stateFile, "on\n")
    await ctx.notify("Meeting", "Meeting mode ON")
  }
}
