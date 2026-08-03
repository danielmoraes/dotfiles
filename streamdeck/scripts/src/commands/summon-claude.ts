import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
import { claudeCommand, openTerminalPlan, parseTerminal } from "../lib/terminal"

/**
 * Open a terminal in the current repo and start Claude Code, optionally with a
 * prepped initial prompt.
 *   summon-claude ["review my working diff"]
 */
export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const repo = ctx.env.STREAMDECK_DEFAULT_REPO ?? join(ctx.home, "code")
  const prompt = args[0]
  const term = parseTerminal(ctx.env.STREAMDECK_TERMINAL)
  const plan = openTerminalPlan(term, claudeCommand(repo, prompt))
  ctx.shell.spawnDetached(plan.bin, plan.args)
}
