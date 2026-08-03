import { expect, test } from "vite-plus/test"
import { augmentedPath } from "./ctx"

test("augmentedPath adds the dirs launchd omits", () => {
  // Stream Deck runs under launchd with only the system dirs, so `gh` and
  // friends are invisible without this.
  const augmented = augmentedPath("/usr/bin:/bin")
  expect(augmented.split(":")).toContain("/opt/homebrew/bin")
  expect(augmented.split(":")).toContain("/usr/local/bin")
})

test("augmentedPath keeps the caller's dirs first and in order", () => {
  const augmented = augmentedPath("/first:/second")
  expect(augmented.startsWith("/first:/second:")).toBe(true)
})

test("augmentedPath does not duplicate a dir already present", () => {
  const dirs = augmentedPath("/opt/homebrew/bin:/usr/bin").split(":")
  expect(dirs.filter((d) => d === "/opt/homebrew/bin")).toHaveLength(1)
})

test("augmentedPath copes with an empty PATH", () => {
  expect(augmentedPath("").split(":")).toContain("/opt/homebrew/bin")
  expect(augmentedPath("").split(":")).not.toContain("")
})
