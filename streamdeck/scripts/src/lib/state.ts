import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Where the toggles keep their "which mode am I in" record.
 *
 * Deliberately **not** `$TMPDIR`. macOS gives a login shell a per-user
 * `TMPDIR` (`/var/folders/…`) but leaves it unset for a launchd-spawned
 * process, which is how the Stream Deck app runs these — so the same command
 * read and wrote two different files depending on who invoked it, and the
 * cycle silently forked in two. `~/.local/state` is stable for both, and
 * survives the reboot that would clear `/tmp` anyway.
 */
export function stateDir(home = homedir()): string {
  return join(home, ".local", "state", "streamdeck")
}

/** Absolute path for one named piece of state. */
export function statePath(name: string, home = homedir()): string {
  return join(stateDir(home), name)
}
