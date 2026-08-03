import { join } from "node:path"
import type { Ctx } from "../lib/ctx"
import {
  agentCommand,
  isAgent,
  openTerminalPlan,
  parseTerminal,
} from "../lib/terminal"

/**
 * Launch an agentic coding CLI in a terminal.
 *   summon-agent claude | codex | pi
 */
export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const agent = args[0] ?? "claude"
  if (!isAgent(agent)) {
    await ctx.notify("Summon agent", `Unknown agent: ${agent}`)
    throw new Error(`unknown agent: ${agent}`)
  }
  const repo = ctx.env.STREAMDECK_DEFAULT_REPO ?? join(ctx.home, "code")
  const term = parseTerminal(ctx.env.STREAMDECK_TERMINAL)
  const plan = openTerminalPlan(term, agentCommand(agent, repo))
  ctx.shell.spawnDetached(plan.bin, plan.args)
}
