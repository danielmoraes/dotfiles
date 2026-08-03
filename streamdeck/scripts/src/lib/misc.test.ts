import { expect, test } from "vite-plus/test"
import { inboxLine } from "./capture"
import { asAppleScriptString } from "./ctx"
import { shellQuote } from "./shell-quote"
import { slackStatusPayload } from "./slack"

test("shellQuote wraps and escapes single quotes", () => {
  expect(shellQuote("plain")).toBe("'plain'")
  expect(shellQuote("it's")).toBe(`'it'\\''s'`)
})

test("asAppleScriptString escapes backslashes and quotes", () => {
  expect(asAppleScriptString("hi")).toBe('"hi"')
  expect(asAppleScriptString('a "b" \\c')).toBe('"a \\"b\\" \\\\c"')
})

test("inboxLine renders a Markdown task", () => {
  expect(inboxLine("buy milk")).toBe("- [ ] buy milk\n")
})

test("slackStatusPayload builds the profile body", () => {
  expect(slackStatusPayload(":no_bell:", "Focusing")).toEqual({
    profile: {
      status_text: "Focusing",
      status_emoji: ":no_bell:",
      status_expiration: 0,
    },
  })
})
