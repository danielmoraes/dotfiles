import { expect, test } from "vite-plus/test"
import {
  PRESETS,
  nextPreset,
  presetByName,
  slackError,
  slackStatusPayload,
} from "./slack"

test("slackError is undefined only when Slack says ok", () => {
  expect(slackError('{"ok":true}')).toBeUndefined()
  expect(slackError('{"ok":true,"warning":"deprecated"}')).toBeUndefined()
})

test("slackError surfaces Slack's error slug", () => {
  // Slack answers HTTP 200 for these, so the body is the only signal.
  expect(slackError('{"ok":false,"error":"invalid_auth"}')).toBe("invalid_auth")
  expect(slackError('{"ok":false,"error":"missing_scope"}')).toBe(
    "missing_scope",
  )
  expect(slackError('{"ok":false}')).toBe("unknown error")
})

test("slackError treats an unusable body as failure, not success", () => {
  expect(slackError("")).toBe("empty response")
  expect(slackError("   ")).toBe("empty response")
  // A captive portal or proxy returning HTML must not read as ok.
  expect(slackError("<html>503</html>")).toBe("unreadable response")
  expect(slackError("null")).toBe("unreadable response")
})

test("slackStatusPayload wraps emoji and text, never expiring", () => {
  expect(slackStatusPayload(":no_bell:", "Focusing")).toEqual({
    profile: {
      status_text: "Focusing",
      status_emoji: ":no_bell:",
      status_expiration: 0,
    },
  })
})

test("an empty payload clears the status", () => {
  expect(slackStatusPayload("", "").profile).toEqual({
    status_text: "",
    status_emoji: "",
    status_expiration: 0,
  })
})

test("presetByName finds known presets only", () => {
  expect(presetByName("focus")?.emoji).toBe(":no_bell:")
  expect(presetByName("clear")?.text).toBe("")
  expect(presetByName("nope")).toBeUndefined()
})

test("nextPreset walks the cycle and wraps", () => {
  expect(nextPreset("available").name).toBe("focus")
  expect(nextPreset("focus").name).toBe("lunch")
  expect(nextPreset("lunch").name).toBe("clear")
  expect(nextPreset("clear").name).toBe("available")
})

test("nextPreset starts from the top for an unknown or empty state", () => {
  expect(nextPreset("").name).toBe("available")
  expect(nextPreset("something-else").name).toBe("available")
})

test("the cycle ends on `clear` so a full lap leaves no status", () => {
  expect(PRESETS[PRESETS.length - 1]?.name).toBe("clear")
  expect(PRESETS[PRESETS.length - 1]?.text).toBe("")
})
