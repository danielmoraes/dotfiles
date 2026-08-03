import type { Ctx } from "./ctx"

/** Run a macOS Shortcut by name; nudge the user to create it if it's missing. */
export async function runShortcut(
  ctx: Ctx,
  name: string,
  notifyTitle: string,
): Promise<void> {
  const res = await ctx.shell.run("shortcuts", ["run", name])
  if (res.code !== 0) {
    await ctx.notify(notifyTitle, `Create a '${name}' Shortcut`)
  }
}
