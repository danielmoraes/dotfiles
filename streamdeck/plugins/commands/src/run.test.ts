import { expect, test } from "vite-plus/test"
import { interpret, outcomeTitle } from "./run"

test("a silent clean exit is success", () => {
  expect(interpret(0, "", "")).toEqual({ ok: true, message: "" })
  expect(interpret(0, "  \n \n", "")).toEqual({ ok: true, message: "" })
})

test("a non-zero exit is failure", () => {
  expect(interpret(1, "", "boom")).toEqual({ ok: false, message: "boom" })
  expect(interpret(127, "", "")).toEqual({ ok: false, message: "exit 127" })
})

test("output on a clean exit still counts as failure", () => {
  // These commands handle their own errors and exit 0 while saying what went
  // wrong. Trusting the exit code alone would paint a tick over a real failure
  // — exactly how the Slack key looked healthy while setting nothing.
  expect(
    interpret(0, "", "Slack rejected the status update: invalid_auth"),
  ).toEqual({
    ok: false,
    message: "Slack rejected the status update: invalid_auth",
  })
  expect(interpret(0, "SLACK_TOKEN not set", "")).toEqual({
    ok: false,
    message: "SLACK_TOKEN not set",
  })
})

test("only the first meaningful line is kept", () => {
  expect(interpret(1, "first thing\nsecond thing", "").message).toBe(
    "first thing",
  )
  expect(interpret(1, "\n\n  real message\nmore", "").message).toBe(
    "real message",
  )
})

test("outcomeTitle ticks a success and keeps the label", () => {
  expect(outcomeTitle({ ok: true, message: "" }, "Status")).toBe("Status\n✓")
})

test("outcomeTitle surfaces a usable word on failure", () => {
  // Two lines on a 72px key, so the clue has to be one short word.
  expect(
    outcomeTitle(
      { ok: false, message: "Slack rejected the status update: invalid_auth" },
      "Status",
    ),
  ).toBe("Status\nSlack")
  expect(outcomeTitle({ ok: false, message: "exit 127" }, "Focus")).toBe(
    "Focus\nexit",
  )
  // Nothing word-like to show falls back to a cross rather than blank.
  expect(outcomeTitle({ ok: false, message: "" }, "Focus")).toBe("Focus\n✗")
  expect(outcomeTitle({ ok: false, message: "a b" }, "Focus")).toBe("Focus\n✗")
})
