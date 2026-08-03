import { expect, test } from "vite-plus/test"
import { stateDir, statePath } from "./state"

test("state lives under ~/.local/state, not $TMPDIR", () => {
  // macOS gives a login shell a per-user $TMPDIR but leaves it unset under
  // launchd, so a TMPDIR-based path forks in two: one file when you run the
  // command yourself, another when the deck does.
  expect(stateDir("/Users/x")).toBe("/Users/x/.local/state/streamdeck")
  expect(statePath("slack-status", "/Users/x")).toBe(
    "/Users/x/.local/state/streamdeck/slack-status",
  )
})

test("every toggle gets its own file in the same directory", () => {
  const paths = ["slack-status", "focus", "meeting"].map((n) =>
    statePath(n, "/Users/x"),
  )
  expect(new Set(paths).size).toBe(3)
  for (const p of paths) {
    expect(p.startsWith(stateDir("/Users/x"))).toBe(true)
  }
})
