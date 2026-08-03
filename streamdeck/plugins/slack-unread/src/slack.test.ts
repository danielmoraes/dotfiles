import { expect, test } from "vite-plus/test"
import { countState, type FetchLike, selectCount, unreadCounts } from "./slack"

/** Build a fake fetch that returns `body` and records the URL it was called with. */
function fakeFetch(
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
) {
  const calls: string[] = []
  const impl: FetchLike = async (url) => {
    calls.push(url)
    return { ok, status, json: async () => body }
  }
  return { impl, calls }
}

const FULL = {
  ok: true,
  channels: [{ mention_count: 2 }, { mention_count: 1 }],
  groups: [{ mention_count: 3 }],
  mpims: [{ mention_count: 1 }],
  ims: [{ dm_count: 4 }, { dm_count: 1 }],
  threads: { mention_count: 2 },
}

test("unreadCounts splits DMs, mentions and threads", async () => {
  const { impl, calls } = fakeFetch(FULL)
  const unread = await unreadCounts({
    apiBase: "https://example.test",
    fetchImpl: impl,
  })
  expect(unread).toEqual({ dms: 5, mentions: 7, threads: 2, total: 14 })
  expect(calls[0]).toBe("https://example.test/users.counts?mpim_aware=true")
})

test("unreadCounts tolerates missing and malformed sections", async () => {
  const { impl } = fakeFetch({ ok: true, ims: [{}, { dm_count: "x" }] })
  expect(await unreadCounts({ fetchImpl: impl })).toEqual({
    dms: 0,
    mentions: 0,
    threads: 0,
    total: 0,
  })
})

test("unreadCounts throws on transport failure", async () => {
  const { impl } = fakeFetch({}, { ok: false, status: 429 })
  await expect(unreadCounts({ fetchImpl: impl })).rejects.toThrow(/HTTP 429/)
})

test("unreadCounts throws on a Slack-level error body", async () => {
  const { impl } = fakeFetch({ ok: false, error: "invalid_auth" })
  await expect(unreadCounts({ fetchImpl: impl })).rejects.toThrow(
    /invalid_auth/,
  )
})

test("selectCount defaults to the total when nothing is selected", () => {
  const unread = { dms: 5, mentions: 7, threads: 2, total: 14 }
  expect(selectCount(unread)).toBe(14)
  expect(selectCount(unread, {})).toBe(14)
  expect(selectCount(unread, { dms: false })).toBe(14)
})

test("selectCount adds only the enabled parts", () => {
  const unread = { dms: 5, mentions: 7, threads: 2, total: 14 }
  expect(selectCount(unread, { dms: true })).toBe(5)
  expect(selectCount(unread, { dms: true, mentions: true })).toBe(12)
  expect(selectCount(unread, { threads: true })).toBe(2)
})

test("countState flips at the threshold", () => {
  expect(countState(0)).toBe(0)
  expect(countState(1)).toBe(1)
  expect(countState(5, 3)).toBe(1)
  expect(countState(2, 3)).toBe(0)
})
