import type { Ctx } from "../lib/ctx"
import {
  formatSummary,
  type MergedPr,
  parsePrLines,
  sinceDate,
  sinceDays,
} from "../lib/standup"

/**
 * Summarize your merged PRs since "yesterday" (covering the weekend on Monday)
 * and copy the summary to the clipboard. Uses the `gh` CLI.
 */
export async function run(ctx: Ctx, _args: string[]): Promise<void> {
  const now = ctx.now()
  const isoDayOfWeek = ((now.getDay() + 6) % 7) + 1 // JS 0=Sun -> ISO 1=Mon..7=Sun
  const since = sinceDate(now, sinceDays(isoDayOfWeek))

  const login = await ghLogin(ctx)
  const prs = await mergedPrs(ctx, since)
  const summary = formatSummary(since, login, prs)

  await ctx.shell.run("pbcopy", [], { input: summary })
  await ctx.notify("Standup", "Summary copied to clipboard")
  ctx.log(summary)
}

async function ghLogin(ctx: Ctx): Promise<string | null> {
  const res = await ctx.shell.run("gh", ["api", "user", "--jq", ".login"])
  const login = res.stdout.trim()
  return res.code === 0 && login ? login : null
}

async function mergedPrs(ctx: Ctx, since: string): Promise<MergedPr[]> {
  const res = await ctx.shell.run("gh", [
    "search",
    "prs",
    "--author",
    "@me",
    "--merged",
    "--merged-at",
    `>=${since}`,
    "--json",
    "title,repository",
    "--template",
    "{{range .}}{{.repository.name}}\t{{.title}}\n{{end}}",
  ])
  return res.code === 0 ? parsePrLines(res.stdout) : []
}
