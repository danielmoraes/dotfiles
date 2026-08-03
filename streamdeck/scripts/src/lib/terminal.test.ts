import { expect, test } from "vite-plus/test"
import {
  agentCommand,
  claudeCommand,
  isAgent,
  openTerminalPlan,
  parseTerminal,
} from "./terminal"

test("agentCommand cd's into a quoted repo dir", () => {
  expect(agentCommand("codex", "/Users/d/my code")).toBe(
    "cd '/Users/d/my code' && codex",
  )
})

test("claudeCommand appends a quoted prompt when given", () => {
  expect(claudeCommand("/repo")).toBe("cd '/repo' && claude")
  expect(claudeCommand("/repo", "fix the bug")).toBe(
    "cd '/repo' && claude 'fix the bug'",
  )
})

test("claudeCommand escapes single quotes in the prompt", () => {
  expect(claudeCommand("/repo", "it's broken")).toBe(
    `cd '/repo' && claude 'it'\\''s broken'`,
  )
})

test("isAgent recognizes only known agents", () => {
  expect(isAgent("claude")).toBe(true)
  expect(isAgent("pi")).toBe(true)
  expect(isAgent("bogus")).toBe(false)
})

test("parseTerminal defaults unknown values to terminal", () => {
  expect(parseTerminal("iterm")).toBe("iterm")
  expect(parseTerminal(undefined)).toBe("terminal")
  expect(parseTerminal("nope")).toBe("terminal")
})

test("openTerminalPlan uses osascript for Terminal and direct exec for wezterm", () => {
  const terminal = openTerminalPlan("terminal", "echo hi")
  expect(terminal.bin).toBe("osascript")
  expect(terminal.args.join(" ")).toContain("do script")

  const wezterm = openTerminalPlan("wezterm", "echo hi")
  expect(wezterm).toEqual({
    bin: "wezterm",
    args: ["start", "--", "bash", "-lc", "echo hi"],
  })
})
