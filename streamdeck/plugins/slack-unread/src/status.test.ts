import { expect, test } from "vite-plus/test"
import {
  type FetchLike,
  currentPresence,
  currentProfile,
  statusLabel,
} from "./status"

const MODES = [
  { name: "clear", emoji: "", text: "", keyLabel: "Online" },
  {
    name: "focus",
    emoji: ":no_bell:",
    text: "Focusing — back later",
    keyLabel: "Focus",
  },
  { name: "away", emoji: "", text: "", keyLabel: "Away" },
]

function fakeFetch(body: unknown, { ok = true, status = 200 } = {}) {
  const calls: string[] = []
  const impl: FetchLike = async (url) => {
    calls.push(url)
    return { ok, status, json: async () => body }
  }
  return { impl, calls }
}

test("currentProfile reads the status emoji and text", async () => {
  const { impl, calls } = fakeFetch({
    ok: true,
    profile: {
      status_emoji: ":no_bell:",
      status_text: "Focusing — back later",
    },
  })
  expect(await currentProfile({ token: "t", fetchImpl: impl })).toEqual({
    emoji: ":no_bell:",
    text: "Focusing — back later",
  })
  expect(calls[0]).toBe("https://slack.com/api/users.profile.get")
})

test("currentProfile needs a token and surfaces Slack's own error", async () => {
  await expect(currentProfile({})).rejects.toThrow(/SLACK_TOKEN/)
  const { impl } = fakeFetch({ ok: false, error: "invalid_auth" })
  await expect(currentProfile({ token: "t", fetchImpl: impl })).rejects.toThrow(
    /invalid_auth/,
  )
})

test("currentPresence reads active or away", async () => {
  const active = fakeFetch({ ok: true, presence: "active" })
  expect(await currentPresence({ token: "t", fetchImpl: active.impl })).toBe(
    "active",
  )
  expect(active.calls[0]).toBe("https://slack.com/api/users.getPresence")
  const away = fakeFetch({ ok: true, presence: "away" })
  expect(await currentPresence({ token: "t", fetchImpl: away.impl })).toBe(
    "away",
  )
})

test("currentPresence surfaces a missing scope rather than guessing", async () => {
  const { impl } = fakeFetch({ ok: false, error: "missing_scope" })
  await expect(
    currentPresence({ token: "t", fetchImpl: impl }),
  ).rejects.toThrow(/missing_scope/)
})

test("statusLabel names a mode it recognises", () => {
  expect(
    statusLabel(
      { emoji: ":no_bell:", text: "Focusing — back later" },
      "active",
      MODES,
    ),
  ).toBe("Focus")
})

test("away wins over whatever the status says", () => {
  // Slack shows you as away regardless of your status text, so the key must
  // too — the away dot is the more consequential fact.
  expect(statusLabel({ emoji: "", text: "" }, "away", MODES)).toBe("Away")
  expect(
    statusLabel(
      { emoji: ":no_bell:", text: "Focusing — back later" },
      "away",
      MODES,
    ),
  ).toBe("Away")
})

test("an empty status while active is Online", () => {
  expect(statusLabel({ emoji: "", text: "" }, "active", MODES)).toBe("Online")
})

test("a status set by hand in Slack is shown, not mislabelled", () => {
  // Better to show what Slack actually says than to claim it's one of ours.
  expect(statusLabel({ emoji: ":coffee:", text: "brb" }, "active", MODES)).toBe(
    "brb",
  )
  expect(statusLabel({ emoji: ":coffee:", text: "" }, "active", MODES)).toBe(
    "set",
  )
  // And it's trimmed to fit the key.
  expect(
    statusLabel(
      { emoji: ":x:", text: "a very long status indeed" },
      "active",
      MODES,
    ),
  ).toHaveLength(8)
})
