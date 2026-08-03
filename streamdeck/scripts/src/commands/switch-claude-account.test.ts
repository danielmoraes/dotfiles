import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import type { Ctx, ExecResult, FsOps, Shell } from "../lib/ctx"
import { run } from "./switch-claude-account"

const HOME = "/home/u"
const ACCOUNTS_DIR = join(HOME, ".claude", "accounts")
const ACTIVE_FILE = join(ACCOUNTS_DIR, ".active")
const credential = (account: string) =>
  join(ACCOUNTS_DIR, account, ".credentials.json")

type State = {
  existing: Set<string>
  files: Map<string, string>
  accounts: string[]
  symlinks: Array<{ target: string; link: string }>
  writes: Map<string, string>
  notes: Array<{ title: string; message: string }>
  logs: string[]
}

function makeState(partial: Partial<State> = {}): State {
  return {
    existing: partial.existing ?? new Set<string>(),
    files: partial.files ?? new Map<string, string>(),
    accounts: partial.accounts ?? [],
    symlinks: [],
    writes: new Map<string, string>(),
    notes: [],
    logs: [],
  }
}

function makeCtx(state: State): Ctx {
  const fs: FsOps = {
    async readdir(dir) {
      return dir === ACCOUNTS_DIR ? [...state.accounts, ".active"] : []
    },
    async exists(path) {
      return state.existing.has(path)
    },
    async readFile(path) {
      return state.files.get(path) ?? ""
    },
    async writeFile(path, data) {
      state.writes.set(path, data)
      state.existing.add(path)
    },
    async appendFile() {},
    async remove(path) {
      state.existing.delete(path)
    },
    async mkdirp() {},
    async symlinkForce(target, link) {
      state.symlinks.push({ target, link })
      state.existing.add(link)
    },
  }
  const shell: Shell = {
    async run(): Promise<ExecResult> {
      return { stdout: "", stderr: "", code: 0 }
    },
    spawnDetached() {},
  }
  return {
    shell,
    fs,
    env: {},
    home: HOME,
    now: () => new Date("2026-08-02T00:00:00Z"),
    async notify(title, message) {
      state.notes.push({ title, message })
    },
    log(message) {
      state.logs.push(message)
    },
  }
}

test("cycles to the next account and symlinks its credentials", async () => {
  const state = makeState({
    accounts: ["personal", "work"],
    existing: new Set([ACTIVE_FILE, credential("work")]),
    files: new Map([[ACTIVE_FILE, "personal\n"]]),
  })
  await run(makeCtx(state), [])

  expect(state.writes.get(ACTIVE_FILE)).toBe("work\n")
  expect(state.symlinks).toEqual([
    {
      target: credential("work"),
      link: join(HOME, ".claude", ".credentials.json"),
    },
  ])
  expect(state.logs).toContain("work")
})

test("--current prints the active account without changing anything", async () => {
  const state = makeState({
    accounts: ["personal", "work"],
    existing: new Set([ACTIVE_FILE]),
    files: new Map([[ACTIVE_FILE, "work\n"]]),
  })
  await run(makeCtx(state), ["--current"])

  expect(state.logs).toEqual(["work"])
  expect(state.symlinks).toEqual([])
  expect(state.writes.size).toBe(0)
})

test("rejects an unknown account", async () => {
  const state = makeState({ accounts: ["personal"] })
  await expect(run(makeCtx(state), ["nope"])).rejects.toThrow(/unknown account/)
  expect(state.notes.at(0)?.message).toContain("Unknown account")
})
