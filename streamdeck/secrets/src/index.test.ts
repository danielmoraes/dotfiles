import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { githubToken, loadSecrets, parseEnv } from "./index"

/** Write a temp secrets file and return its path. */
function secretsFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "sd-secrets-"))
  const path = join(dir, "secrets.env")
  writeFileSync(path, contents)
  return path
}

test("parseEnv reads plain key=value pairs", () => {
  expect(parseEnv("A=1\nB=two\n")).toEqual({ A: "1", B: "two" })
})

test("parseEnv skips comments and blank lines", () => {
  expect(parseEnv("# a comment\n\nA=1\n   \n#B=2\n")).toEqual({ A: "1" })
})

test("parseEnv strips `export` and surrounding quotes", () => {
  expect(parseEnv(`export A="quoted"\nB='single'\nC=bare\n`)).toEqual({
    A: "quoted",
    B: "single",
    C: "bare",
  })
})

test("parseEnv keeps empty values and values containing =", () => {
  expect(parseEnv("EMPTY=\nURL=https://x.test/?a=b&c=d\n")).toEqual({
    EMPTY: "",
    URL: "https://x.test/?a=b&c=d",
  })
})

test("parseEnv ignores malformed keys and lines without =", () => {
  expect(parseEnv("no-equals-here\n=novalue\n1BAD=x\nGOOD=y\n")).toEqual({
    GOOD: "y",
  })
})

test("loadSecrets fills only unset or empty variables", () => {
  const path = secretsFile("TOKEN=from-file\nOTHER=also-file\nBLANK=\n")
  const env: NodeJS.ProcessEnv = { TOKEN: "already-set", BLANK: "keep-me" }
  loadSecrets(path, env)
  // An existing value wins, so a one-off override still works.
  expect(env.TOKEN).toBe("already-set")
  expect(env.OTHER).toBe("also-file")
  // An empty value in the file must not blank a real one.
  expect(env.BLANK).toBe("keep-me")
})

test("loadSecrets treats an empty existing value as unset", () => {
  const path = secretsFile("TOKEN=from-file\n")
  const env: NodeJS.ProcessEnv = { TOKEN: "" }
  loadSecrets(path, env)
  expect(env.TOKEN).toBe("from-file")
})

test("a missing secrets file is not an error", () => {
  const env: NodeJS.ProcessEnv = {}
  expect(() => loadSecrets("/nope/does-not-exist.env", env)).not.toThrow()
  expect(Object.keys(env)).toEqual([])
})

test("githubToken prefers GITHUB_TOKEN and never shells out", () => {
  let called = false
  const run = (): string => {
    called = true
    return "gho_from_gh"
  }
  expect(githubToken({ GITHUB_TOKEN: "from-env" }, run)).toBe("from-env")
  expect(called).toBe(false)
})

test("githubToken falls back to `gh auth token`", () => {
  const calls: string[][] = []
  const run = (cmd: string, args: string[]): string => {
    calls.push([cmd, ...args])
    return "gho_from_gh\n"
  }
  expect(githubToken({}, run)).toBe("gho_from_gh")
  expect(calls).toEqual([["gh", "auth", "token"]])
  // An empty GITHUB_TOKEN counts as unset.
  expect(githubToken({ GITHUB_TOKEN: "" }, run)).toBe("gho_from_gh")
})

test("githubToken returns undefined when gh is missing or logged out", () => {
  const missing = (): string => {
    throw new Error("gh: command not found")
  }
  expect(githubToken({}, missing)).toBeUndefined()
  expect(githubToken({}, () => "  \n")).toBeUndefined()
})
