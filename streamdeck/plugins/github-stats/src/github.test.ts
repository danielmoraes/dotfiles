import { expect, test } from "vite-plus/test"
import {
  countState,
  type FetchLike,
  latestRunConclusion,
  searchCount,
} from "./github"
import { ciState } from "./actions/ci-status"

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

test("searchCount returns total_count and builds the search URL", async () => {
  const { impl, calls } = fakeFetch({ total_count: 3, items: [] })
  const n = await searchCount("is:open is:pr review-requested:@me", {
    apiBase: "https://example.test",
    fetchImpl: impl,
  })
  expect(n).toBe(3)
  expect(calls[0]).toMatch(/^https:\/\/example\.test\/search\/issues\?q=/)
  expect(calls[0]).toContain("review-requested")
})

test("searchCount defaults missing total_count to 0", async () => {
  const { impl } = fakeFetch({})
  expect(await searchCount("x", { fetchImpl: impl })).toBe(0)
})

test("searchCount throws on non-OK response", async () => {
  const { impl } = fakeFetch({}, { ok: false, status: 401 })
  await expect(searchCount("x", { fetchImpl: impl })).rejects.toThrow(
    /HTTP 401/,
  )
})

test("latestRunConclusion maps run status/conclusion", async () => {
  const mk = (run: unknown) =>
    fakeFetch({ workflow_runs: run ? [run] : [] }).impl
  expect(
    await latestRunConclusion("o/r", "main", {
      fetchImpl: mk({ status: "completed", conclusion: "success" }),
    }),
  ).toBe("success")
  expect(
    await latestRunConclusion("o/r", "main", {
      fetchImpl: mk({ status: "completed", conclusion: "failure" }),
    }),
  ).toBe("failure")
  expect(
    await latestRunConclusion("o/r", "main", {
      fetchImpl: mk({ status: "in_progress" }),
    }),
  ).toBe("pending")
  expect(
    await latestRunConclusion("o/r", "main", { fetchImpl: mk(null) }),
  ).toBe("unknown")
})

test("countState flips at the threshold", () => {
  expect(countState(0)).toBe(0)
  expect(countState(1)).toBe(1)
  expect(countState(5, 3)).toBe(1)
  expect(countState(2, 3)).toBe(0)
})

test("ciState reddens a real failure but not a pending or unknown build", () => {
  // A build still running isn't news; making the colour mean "not green" would
  // have it red most mornings and stop carrying information.
  expect(ciState("failure")).toBe(1)
  expect(ciState("success")).toBe(0)
  expect(ciState("pending")).toBe(0)
  expect(ciState("unknown")).toBe(0)
})
