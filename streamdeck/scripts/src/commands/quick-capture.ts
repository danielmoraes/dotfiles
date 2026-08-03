import { basename, join } from "node:path"
import { inboxLine } from "../lib/capture"
import type { Ctx } from "../lib/ctx"

/**
 * Prompt for a note and append it to the inbox file, or open a GitHub issue.
 *   quick-capture                    append to $STREAMDECK_INBOX (~/inbox.md)
 *   quick-capture --issue owner/repo open a GitHub issue via gh
 */
export async function run(ctx: Ctx, args: string[]): Promise<void> {
  const text = await promptText(ctx)
  if (!text) {
    return
  }

  const issueRepo = args[1]
  if (args[0] === "--issue" && issueRepo) {
    await createIssue(ctx, issueRepo, text)
    return
  }

  const inbox = ctx.env.STREAMDECK_INBOX ?? join(ctx.home, "inbox.md")
  await ctx.fs.appendFile(inbox, inboxLine(text))
  await ctx.notify("Quick capture", `Saved to ${basename(inbox)}`)
}

async function promptText(ctx: Ctx): Promise<string> {
  const dialog =
    'Tell application "System Events" to display dialog "Capture:" default answer "" buttons {"Cancel","Save"} default button "Save"'
  const res = await ctx.shell.run("osascript", [
    "-e",
    dialog,
    "-e",
    "text returned of result",
  ])
  return res.code === 0 ? res.stdout.trim() : ""
}

async function createIssue(
  ctx: Ctx,
  repo: string,
  title: string,
): Promise<void> {
  const res = await ctx.shell.run("gh", [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body",
    "Captured from Stream Deck",
  ])
  await ctx.notify(
    "Quick capture",
    res.code === 0 ? `Issue created in ${repo}` : "gh issue create failed",
  )
}
