import type { Ctx } from "../lib/ctx"
import { stateDir, statePath } from "../lib/state"
import { runShortcut } from "../lib/shortcuts"

/**
 * Toggle meeting mode: run a "Meeting On"/"Meeting Off" Shortcut (Focus + mic
 * mute). Toggles off on a second run using a state file.
 *
 * It used to pause the music first, via `tell application "Spotify" to pause`.
 * That went with Spotify, and wasn't worth generalising: AppleScript's `tell`
 * *launches* an app that isn't running, and the generic media-key route can't
 * pause Focus@Will, the player that took its place — see the dial strip's
 * comment in `../../../profiles/src/layout.ts` for why that's a Focus@Will bug
 * no sender can work around. Pausing is a keystroke away in the player itself;
 * silently launching an unused app, or shipping a pause that does nothing, is
 * worse than not claiming to pause at all. Put it back in the "Meeting On"
 * Shortcut if it's wanted — that's user-editable and player-specific.
 */
export async function run(ctx: Ctx, _args: string[]): Promise<void> {
  const stateFile = statePath("meeting", ctx.home)
  if (await ctx.fs.exists(stateFile)) {
    await runShortcut(ctx, "Meeting Off", "Meeting")
    await ctx.fs.remove(stateFile)
    await ctx.notify("Meeting", "Meeting mode OFF")
  } else {
    await runShortcut(ctx, "Meeting On", "Meeting")
    await ctx.fs.mkdirp(stateDir(ctx.home))
    await ctx.fs.writeFile(stateFile, "on\n")
    await ctx.notify("Meeting", "Meeting mode ON")
  }
}
