/** Standup helpers, kept pure. The command layer calls `gh` and the clipboard. */

export type MergedPr = { repo: string; title: string }

/** How many days back "yesterday" reaches, covering weekends on Monday. */
export function sinceDays(isoDayOfWeek: number): number {
  // isoDayOfWeek: 1 = Monday .. 7 = Sunday.
  return isoDayOfWeek === 1 ? 3 : 1
}

/** The `YYYY-MM-DD` cutoff `days` before `now` (computed in UTC). */
export function sinceDate(now: Date, days: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days),
  )
  return d.toISOString().slice(0, 10)
}

/** Parse tab-separated `repo\ttitle` lines from `gh search prs --template`. */
export function parsePrLines(output: string): MergedPr[] {
  return output.split("\n").flatMap((line) => {
    const tab = line.indexOf("\t")
    if (tab === -1) {
      return []
    }
    return [{ repo: line.slice(0, tab), title: line.slice(tab + 1) }]
  })
}

/** Compose the standup summary text for the clipboard. */
export function formatSummary(
  since: string,
  login: string | null,
  prs: readonly MergedPr[],
): string {
  const who = login ? ` (@${login})` : ""
  const header = `*Standup — merged since ${since}${who}*`
  if (prs.length === 0) {
    return `${header}\n  (no merged PRs found; check gh auth / GITHUB_TOKEN)`
  }
  const lines = prs.map((pr) => `- ${pr.repo}: ${pr.title}`)
  return `${header}\n${lines.join("\n")}`
}
