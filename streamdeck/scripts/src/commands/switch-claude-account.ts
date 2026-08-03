import { join } from "node:path"
import { ACCOUNT_FILES, nextInCycle } from "../lib/accounts"
import type { Ctx } from "../lib/ctx"

/**
 * Switch the active Claude Code account by symlinking a stored account's files
 * into ~/.claude. Accounts live in ~/.claude/accounts/<name>/.
 *
 *   switch-claude-account            cycle to the next account
 *   switch-claude-account <name>     switch to a specific account
 *   switch-claude-account --current  print the active account name
 */
export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const accountsDir = join(ctx.home, ".claude", "accounts")
  const activeFile = join(accountsDir, ".active")
  const targetDir = join(ctx.home, ".claude")

  await ctx.fs.mkdirp(accountsDir)

  const current = (await ctx.fs.exists(activeFile))
    ? (await ctx.fs.readFile(activeFile)).trim() || null
    : null

  if (args[0] === "--current") {
    ctx.log(current ?? "")
    return
  }

  // Account names are the sub-directories (skip the .active marker file).
  const accounts = (await ctx.fs.readdir(accountsDir))
    .filter((name) => !name.startsWith("."))
    .sort()

  const requested = args[0]
  const target = requested ? requested : nextInCycle(accounts, current)

  if (!accounts.includes(target)) {
    await ctx.notify("Claude account", `Unknown account: ${target}`)
    throw new Error(`unknown account: ${target}`)
  }

  for (const file of ACCOUNT_FILES) {
    const src = join(accountsDir, target, file)
    if (await ctx.fs.exists(src)) {
      await ctx.fs.symlinkForce(src, join(targetDir, file))
    }
  }
  await ctx.fs.writeFile(activeFile, `${target}\n`)
  await ctx.notify("Claude account", `Switched to: ${target}`)
  ctx.log(target)
}
