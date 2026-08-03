import { expect, test } from "vite-plus/test"
import { nextInCycle } from "./accounts"

test("nextInCycle advances and wraps", () => {
  const accounts = ["personal", "work"]
  expect(nextInCycle(accounts, "personal")).toBe("work")
  expect(nextInCycle(accounts, "work")).toBe("personal")
})

test("nextInCycle falls back to first when none active or unknown", () => {
  const accounts = ["a", "b", "c"]
  expect(nextInCycle(accounts, null)).toBe("a")
  expect(nextInCycle(accounts, "missing")).toBe("a")
})

test("nextInCycle throws when there are no accounts", () => {
  expect(() => nextInCycle([], null)).toThrow(/no Claude accounts/)
})
