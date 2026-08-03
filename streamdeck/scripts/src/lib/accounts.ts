/**
 * Account-switching logic for Claude Code, kept pure for testing. The command
 * layer handles the filesystem symlinking.
 */

/** Files that constitute a Claude Code account (relative to ~/.claude). */
export const ACCOUNT_FILES = [".credentials.json"] as const

/**
 * Given the configured accounts (sorted) and the active one, return the next
 * account in the cycle. Falls back to the first account when none is active or
 * the active one is unknown.
 */
export function nextInCycle(
  accounts: readonly string[],
  current: string | null,
): string {
  const first = accounts[0]
  if (first === undefined) {
    throw new Error("no Claude accounts configured")
  }
  if (current === null) {
    return first
  }
  const index = accounts.indexOf(current)
  if (index === -1) {
    return first
  }
  return accounts[(index + 1) % accounts.length] ?? first
}
