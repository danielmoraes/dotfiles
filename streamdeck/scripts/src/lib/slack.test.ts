import { expect, test } from "vite-plus/test"
import {
  PRESETS,
  nextPreset,
  presetByName,
  presetFromStatus,
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
  expect(presetByName("away")?.presence).toBe("away")
  expect(presetByName("available")).toBeUndefined()
  expect(presetByName("lunch")).toBeUndefined()
})

test("nextPreset walks the three-state cycle and wraps", () => {
  expect(nextPreset("clear").name).toBe("focus")
  expect(nextPreset("focus").name).toBe("away")
  expect(nextPreset("away").name).toBe("clear")
})

test("nextPreset starts from the top for an unknown or empty state", () => {
  expect(nextPreset("").name).toBe("focus")
  expect(nextPreset("something-else").name).toBe("focus")
})

test("only away forces presence; the rest let Slack decide", () => {
  // Showing online with a Lunch message is visible but still gettable — away
  // has to be a presence change, not just a status string.
  expect(
    PRESETS.filter((p) => p.presence === "away").map((p) => p.name),
  ).toEqual(["away"])
})

test("clear is the empty status, so there is no separate Available", () => {
  const clear = presetByName("clear")
  expect(clear?.emoji).toBe("")
  expect(clear?.text).toBe("")
  expect(clear?.presence).toBe("auto")
})

test("presetFromStatus recognises a live profile", () => {
  expect(presetFromStatus("", "")?.name).toBe("clear")
  expect(presetFromStatus(":no_bell:", "Focusing — back later")?.name).toBe(
    "focus",
  )
  expect(presetFromStatus(":palm_tree:", "Away")?.name).toBe("away")
  // A status set by hand in Slack isn't one of ours.
  expect(presetFromStatus(":coffee:", "brb")).toBeUndefined()
})

test("every preset has a key label short enough for a 72px key", () => {
  for (const p of PRESETS) {
    expect(p.keyLabel.length, p.name).toBeLessThanOrEqual(8)
  }
})
