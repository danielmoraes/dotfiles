import { expect, test } from "vite-plus/test"
import { formatSummary, parsePrLines, sinceDate, sinceDays } from "./standup"

test("sinceDays reaches back over the weekend on Monday only", () => {
  expect(sinceDays(1)).toBe(3) // Monday
  expect(sinceDays(3)).toBe(1) // Wednesday
  expect(sinceDays(5)).toBe(1) // Friday
})

test("sinceDate subtracts days in UTC", () => {
  expect(sinceDate(new Date("2026-08-03T09:00:00Z"), 1)).toBe("2026-08-02")
  expect(sinceDate(new Date("2026-08-03T09:00:00Z"), 3)).toBe("2026-07-31")
})

test("parsePrLines splits tab-separated rows and ignores blanks", () => {
  const out = "dotfiles\tAdd scripts\nweb\tFix login\n\n"
  expect(parsePrLines(out)).toEqual([
    { repo: "dotfiles", title: "Add scripts" },
    { repo: "web", title: "Fix login" },
  ])
})

test("formatSummary lists PRs, with a fallback when empty", () => {
  const withPrs = formatSummary("2026-08-02", "dan", [
    { repo: "dotfiles", title: "Add scripts" },
  ])
  expect(withPrs).toBe(
    "*Standup — merged since 2026-08-02 (@dan)*\n- dotfiles: Add scripts",
  )

  const empty = formatSummary("2026-08-02", null, [])
  expect(empty).toContain("no merged PRs found")
})
