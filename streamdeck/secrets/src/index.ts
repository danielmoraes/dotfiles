import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Load `~/.config/streamdeck/secrets.env` into `process.env`.
 *
 * Both the plugins and the `sd-*` commands are launched *by the Stream Deck
 * app*, which inherits the macOS login environment — not your shell's. So none
 * of the tokens exported by a shell rc are visible to them, and reading
 * `process.env.GITHUB_TOKEN` alone always came back empty in practice.
 *
 * Every consumer calls this once at startup so the documented contract in
 * `streamdeck/README.md` ("scripts and plugins read from secrets.env") actually
 * holds.
 */

export const SECRETS_PATH = join(
  homedir(),
  ".config",
  "streamdeck",
  "secrets.env",
)

/**
 * Parse a dotenv-style file.
 *
 * Deliberately minimal — this reads a file we generate ourselves
 * (`install.sh`), so it covers `KEY=value`, `export KEY=value`, `#` comments,
 * blank lines, and optional single/double quotes. No interpolation, no
 * multi-line values.
 */
export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === "" || line.startsWith("#")) {
      continue
    }
    const withoutExport = line.startsWith("export ")
      ? line.slice(7).trim()
      : line
    const eq = withoutExport.indexOf("=")
    if (eq <= 0) {
      continue
    }
    const key = withoutExport.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue
    }
    let value = withoutExport.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * Merge the secrets file into `process.env`.
 *
 * A variable already present in the environment wins, so you can still
 * override a key for one run (`GITHUB_TOKEN=… sd-standup`). Empty values in
 * the file are skipped rather than blanking a real one. Missing file is not an
 * error — the deck should degrade to "no token", not crash.
 */
export function loadSecrets(
  path: string = SECRETS_PATH,
  env: NodeJS.ProcessEnv = process.env,
): void {
  let contents: string
  try {
    contents = readFileSync(path, "utf8")
  } catch {
    return
  }
  for (const [key, value] of Object.entries(parseEnv(contents))) {
    if (value !== "" && (env[key] === undefined || env[key] === "")) {
      env[key] = value
    }
  }
}

/** How `githubToken` shells out; injectable so the fallback is testable. */
export type CommandRunner = (cmd: string, args: string[]) => string

const runCommand: CommandRunner = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

/**
 * Where `gh` might be, beyond a bare `PATH` lookup.
 *
 * The Stream Deck app is launched by launchd, whose `PATH` is only
 * `/usr/bin:/bin:/usr/sbin:/sbin` — so a plain `gh` lookup fails in exactly the
 * environment the plugins actually run in, and the fallback below would quietly
 * return no token. These are the standard Homebrew and manual install roots.
 */
const GH_CANDIDATES = [
  "gh",
  "/opt/homebrew/bin/gh",
  "/usr/local/bin/gh",
  "/usr/bin/gh",
]

/**
 * Resolve a GitHub token, preferring `GITHUB_TOKEN` and falling back to the
 * one `gh` already holds.
 *
 * `gh` is a dependency of these commands anyway, and it keeps its token in the
 * system keyring — so borrowing it beats copying a second, drifting copy of
 * the same secret into `secrets.env`. Returns undefined if neither is present;
 * callers surface that as "no token" on the key.
 */
export function githubToken(
  env: NodeJS.ProcessEnv = process.env,
  run: CommandRunner = runCommand,
  candidates: readonly string[] = GH_CANDIDATES,
): string | undefined {
  const fromEnv = env.GITHUB_TOKEN
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv
  }
  for (const gh of candidates) {
    try {
      const token = run(gh, ["auth", "token"]).trim()
      if (token !== "") {
        return token
      }
    } catch {
      // Not at this path (or not logged in) — try the next.
    }
  }
  return undefined
}
