/**
 * Reading (and switching) Claude accounts through the `cswap` CLI.
 *
 * `cswap` (the `claude-swap` package) already owns the hard parts — the OAuth
 * tokens, the macOS Keychain, and the usage API — and speaks a versioned JSON
 * schema for exactly this purpose. So this plugin shells out rather than
 * reimplementing any of it, the same way the Slack status key defers to
 * `sd-slack-status`: the CLI owns the behaviour, the dial is its face.
 *
 * Every field below is optional in the source, and deliberately so — the usage
 * API doesn't return every window for every plan, and `usage` is null outright
 * whenever `usageStatus` isn't `"ok"`. Nothing here assumes a shape it hasn't
 * checked, because a missing key must read as "no data" on the strip rather
 * than crash the dial.
 */

import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Absolute path, never a bare `cswap`.
 *
 * The Stream Deck app is launched by launchd, whose `PATH` is
 * `/usr/bin:/bin:/usr/sbin:/sbin` — nothing installed by uv, homebrew or nvm is
 * on it. The binary itself is fine to exec: it's a uv tool shim whose shebang
 * points at an absolute interpreter, so it needs nothing from `PATH` to run.
 */
export const CSWAP = join(homedir(), ".local", "bin", "cswap")

/** A 5h / 7d rolling limit. */
export type UsageWindow = {
  /** Percentage of the window consumed, 0..100. */
  pct: number
  /** Human countdown to the reset, e.g. `"4h 25m"`. */
  countdown?: string
  /** Wall-clock reset time, e.g. `"20:00"` or `"Aug 9 00:00"`. */
  clock?: string
}

/** Pay-as-you-go spend against a cap, on accounts that have one. */
export type Spend = {
  used: number
  limit: number
  pct: number
  currency: string
}

/** A per-model weekly limit, e.g. Fable. */
export type ScopedWindow = UsageWindow & { name: string }

export type Usage = {
  fiveHour?: UsageWindow
  sevenDay?: UsageWindow
  spend?: Spend
  scoped?: ScopedWindow[]
}

/**
 * Why an account has usage, or hasn't.
 *
 * Anything other than `"ok"` means `usage` is absent — these are the states
 * where cswap can't read a quota at all, and each wants a different word on the
 * strip (a locked Keychain is not the same problem as an expired token).
 */
export type UsageStatus =
  | "ok"
  | "token_expired"
  | "api_key"
  | "keychain_unavailable"
  | "no_credentials"
  | "unavailable"

export type Account = {
  /** cswap's 1-based slot number; what `--switch-to` takes. */
  number: number
  email: string
  organizationName?: string
  /** Whether this is the account Claude Code is currently signed in as. */
  active: boolean
  usageStatus: UsageStatus
  usage?: Usage
}

/** How the CLI is invoked; injectable so parsing is testable without a shell. */
export type Exec = (args: readonly string[]) => string

const TIMEOUT_MS = 20_000

const realExec: Exec = (args) =>
  execFileSync(CSWAP, [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: TIMEOUT_MS,
  })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

/**
 * Narrow cswap's status string to the union.
 *
 * A `switch` rather than a lookup table so the compiler checks each arm against
 * `UsageStatus` — and an unknown value from a future cswap degrades to
 * `"unavailable"`, which is already the "we have no usage" rendering, instead
 * of being trusted blindly.
 */
function usageStatus(value: unknown): UsageStatus {
  switch (value) {
    case "ok":
    case "token_expired":
    case "api_key":
    case "keychain_unavailable":
    case "no_credentials":
      return value
    default:
      return "unavailable"
  }
}

function parseWindow(value: unknown): UsageWindow | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const pct = num(value.pct)
  if (pct === undefined) {
    return undefined
  }
  return { pct, countdown: str(value.countdown), clock: str(value.clock) }
}

function parseSpend(value: unknown): Spend | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const used = num(value.used)
  const limit = num(value.limit)
  const pct = num(value.pct)
  if (used === undefined || limit === undefined || pct === undefined) {
    return undefined
  }
  return { used, limit, pct, currency: str(value.currency) ?? "USD" }
}

function parseUsage(value: unknown): Usage | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const scoped: ScopedWindow[] = []
  if (Array.isArray(value.scoped)) {
    for (const entry of value.scoped) {
      const window = parseWindow(entry)
      const name = isRecord(entry) ? str(entry.name) : undefined
      if (window && name !== undefined) {
        scoped.push({ ...window, name })
      }
    }
  }
  return {
    fiveHour: parseWindow(value.fiveHour),
    sevenDay: parseWindow(value.sevenDay),
    spend: parseSpend(value.spend),
    scoped: scoped.length > 0 ? scoped : undefined,
  }
}

function parseAccount(value: unknown): Account | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const number = num(value.number)
  const email = str(value.email)
  if (number === undefined || email === undefined) {
    return undefined
  }
  return {
    number,
    email,
    organizationName: str(value.organizationName),
    active: value.active === true,
    usageStatus: usageStatus(value.usageStatus),
    usage: parseUsage(value.usage),
  }
}

/** Parse the JSON, surfacing cswap's own structured error as an exception. */
function parsePayload(stdout: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error("cswap did not return JSON")
  }
  if (!isRecord(parsed)) {
    throw new Error("cswap returned an unexpected payload")
  }
  // cswap reports handled failures as `{ error: { type, message } }` on a zero
  // exit, so the envelope has to be checked even when the command "succeeded".
  if (isRecord(parsed.error)) {
    throw new Error(str(parsed.error.message) ?? "cswap failed")
  }
  return parsed
}

/** Every managed account and its usage, in cswap's slot order. */
export function listAccounts(exec: Exec = realExec): Account[] {
  const payload = parsePayload(exec(["--list", "--json"]))
  if (!Array.isArray(payload.accounts)) {
    throw new Error("cswap --list returned no accounts")
  }
  const accounts: Account[] = []
  for (const entry of payload.accounts) {
    const account = parseAccount(entry)
    if (account) {
      accounts.push(account)
    }
  }
  if (accounts.length === 0) {
    throw new Error("cswap manages no accounts")
  }
  return accounts
}

/**
 * How the dial picks the account to switch to.
 *
 * `rotate` is cswap's plain `--switch`: advance to the next slot, which with
 * two accounts is simply a toggle. The other two hand the choice to cswap's own
 * quota-aware strategies.
 */
export type SwitchStrategy = "rotate" | "best" | "next-available"

/** Switch the active account. Returns once cswap has swapped the credentials. */
export function switchAccount(
  strategy: SwitchStrategy = "rotate",
  exec: Exec = realExec,
): void {
  const args =
    strategy === "rotate"
      ? ["--switch", "--json"]
      : ["--switch", "--json", "--strategy", strategy]
  parsePayload(exec(args))
}
