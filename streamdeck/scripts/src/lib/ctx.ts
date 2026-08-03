import { spawn } from "node:child_process"
import {
  access,
  appendFile,
  mkdir,
  readdir,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises"
import { loadSecrets } from "streamdeck-secrets"

/** Result of running a subprocess to completion. */
export type ExecResult = {
  stdout: string
  stderr: string
  code: number
}

/** Subprocess boundary — faked in tests. */
export type Shell = {
  /** Run a command to completion, optionally piping `input` to stdin. */
  run(
    cmd: string,
    args: string[],
    opts?: { input?: string },
  ): Promise<ExecResult>
  /** Launch a detached process (e.g. a terminal window) and return. */
  spawnDetached(cmd: string, args: string[]): void
}

/** Filesystem boundary — faked in tests. */
export type FsOps = {
  readdir(dir: string): Promise<string[]>
  exists(path: string): Promise<boolean>
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  appendFile(path: string, data: string): Promise<void>
  remove(path: string): Promise<void>
  mkdirp(dir: string): Promise<void>
  /** Create or replace a symlink at `linkPath` pointing to `target`. */
  symlinkForce(target: string, linkPath: string): Promise<void>
}

/** Everything a command touches, injected so commands are unit-testable. */
export type Ctx = {
  shell: Shell
  fs: FsOps
  env: NodeJS.ProcessEnv
  home: string
  now(): Date
  notify(title: string, message: string): Promise<void>
  log(message: string): void
}

/**
 * Directories added to `PATH` for anything these commands spawn.
 *
 * Keys invoke these through the Stream Deck app, which runs under launchd with
 * `PATH=/usr/bin:/bin:/usr/sbin:/sbin`. Tools installed by Homebrew or into
 * `~/.local/bin` — `gh` above all — simply aren't found there, and the failure
 * surfaces as a bare `spawn gh ENOENT` long after the useful context is gone.
 * Appending rather than replacing keeps a caller's own `PATH` authoritative.
 */
const EXTRA_PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  `${process.env.HOME ?? ""}/.local/bin`,
]

/** `PATH` with the dirs above appended, deduplicated, order preserved. */
export function augmentedPath(current = process.env.PATH ?? ""): string {
  const seen = new Set<string>()
  return [...current.split(":"), ...EXTRA_PATH]
    .filter(
      (dir) => dir !== "" && !seen.has(dir) && seen.add(dir) !== undefined,
    )
    .join(":")
}

const spawnEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  PATH: augmentedPath(),
})

const realShell: Shell = {
  run(cmd, args, opts) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: spawnEnv(),
      })
      let stdout = ""
      let stderr = ""
      child.stdout.on("data", (d) => (stdout += d.toString()))
      child.stderr.on("data", (d) => (stderr += d.toString()))
      child.on("error", reject)
      child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }))
      if (opts?.input !== undefined) {
        child.stdin.end(opts.input)
      } else {
        child.stdin.end()
      }
    })
  },
  spawnDetached(cmd, args) {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
      env: spawnEnv(),
    })
    child.unref()
  },
}

const realFs: FsOps = {
  readdir: (dir) => readdir(dir),
  async exists(path) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  },
  readFile: (path) => readFile(path, "utf8"),
  writeFile: (path, data) => writeFile(path, data),
  appendFile: (path, data) => appendFile(path, data),
  async remove(path) {
    try {
      await unlink(path)
    } catch {
      // already gone — fine
    }
  },
  async mkdirp(dir) {
    await mkdir(dir, { recursive: true })
  },
  async symlinkForce(target, linkPath) {
    await this.remove(linkPath)
    await symlink(target, linkPath)
  },
}

/** Build the real, side-effecting context used by the bin entry points. */
export function realCtx(): Ctx {
  // Keys invoke these commands through the Stream Deck app, which passes the
  // login environment rather than a shell's — so tokens have to be read off
  // disk here or `ctx.env.SLACK_TOKEN` and friends are always empty.
  loadSecrets()
  const home = process.env.HOME ?? ""
  return {
    shell: realShell,
    fs: realFs,
    env: process.env,
    home,
    now: () => new Date(),
    async notify(title, message) {
      const script = `display notification ${asAppleScriptString(
        message,
      )} with title ${asAppleScriptString(title)}`
      await realShell.run("osascript", ["-e", script])
    },
    log(message) {
      console.error(message)
    },
  }
}

/** Quote a string as an AppleScript string literal. */
export function asAppleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}
