import { expect, test } from "vite-plus/test"
import { type FetchLike, currentProfile, statusLabel } from "./status"

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

test("statusLabel names a mode it recognises", () => {
  expect(
    statusLabel({ emoji: ":no_bell:", text: "Focusing — back later" }, MODES),
  ).toBe("Focus")
  expect(statusLabel({ emoji: ":palm_tree:", text: "Away" }, MODES)).toBe(
    "Away",
  )
})

test("an empty status is Online, unless we know we set away", () => {
  // Presence isn't readable without the users:read scope, so away with no
  // status text can only come from our own record.
  expect(statusLabel({ emoji: "", text: "" }, MODES)).toBe("Online")
  expect(statusLabel({ emoji: "", text: "" }, MODES, "away")).toBe("Away")
  expect(statusLabel({ emoji: "", text: "" }, MODES, "focus")).toBe("Online")
})

test("a status set by hand in Slack is shown, not mislabelled", () => {
  // Better to show what Slack actually says than to claim it's one of ours.
  expect(statusLabel({ emoji: ":coffee:", text: "brb" }, MODES)).toBe("brb")
  expect(statusLabel({ emoji: ":coffee:", text: "" }, MODES)).toBe("set")
  // And it's trimmed to fit the key.
  expect(
    statusLabel({ emoji: ":x:", text: "a very long status indeed" }, MODES),
  ).toHaveLength(8)
})
