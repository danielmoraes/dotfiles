import { asAppleScriptString } from "./ctx"
import { shellQuote } from "./shell-quote"

export type Agent = "claude" | "codex" | "pi"
export type TerminalApp = "terminal" | "iterm" | "wezterm" | "kitty"

const AGENTS: readonly Agent[] = ["claude", "codex", "pi"]

export function isAgent(value: string): value is Agent {
  return AGENTS.some((agent) => agent === value)
}

export function parseTerminal(value: string | undefined): TerminalApp {
  switch (value) {
    case "iterm":
    case "wezterm":
    case "kitty":
      return value
    default:
      return "terminal"
  }
}

/** Shell command that cd's into `repoDir` and launches `agent`. */
export function agentCommand(agent: Agent, repoDir: string): string {
  return `cd ${shellQuote(repoDir)} && ${agent}`
}

/** Shell command that starts Claude Code, optionally with an initial prompt. */
export function claudeCommand(repoDir: string, prompt?: string): string {
  const base = `cd ${shellQuote(repoDir)} && claude`
  return prompt ? `${base} ${shellQuote(prompt)}` : base
}

/** The subprocess to spawn to run `command` in the chosen terminal. */
export function openTerminalPlan(
  term: TerminalApp,
  command: string,
): { bin: string; args: string[] } {
  switch (term) {
    case "iterm":
      return {
        bin: "osascript",
        args: [
          "-e",
          'tell application "iTerm" to create window with default profile',
          "-e",
          `tell application "iTerm" to tell current session of current window to write text ${asAppleScriptString(
            command,
          )}`,
        ],
      }
    case "wezterm":
      return { bin: "wezterm", args: ["start", "--", "bash", "-lc", command] }
    case "kitty":
      return {
        bin: "kitty",
        args: ["@", "launch", "--type=os-window", "bash", "-lc", command],
      }
    default:
      return {
        bin: "osascript",
        args: [
          "-e",
          'tell application "Terminal" to activate',
          "-e",
          `tell application "Terminal" to do script ${asAppleScriptString(command)}`,
        ],
      }
  }
}
