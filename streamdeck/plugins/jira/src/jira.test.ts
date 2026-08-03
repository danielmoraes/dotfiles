import { expect, test } from "vite-plus/test"
import {
  type FetchLike,
  countState,
  issueNavigatorUrl,
  jqlCount,
  normalizeBase,
} from "./jira"

function fakeFetch(body: unknown, { ok = true, status = 200 } = {}) {
  const calls: { url: string; body: string }[] = []
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body })
    return { ok, status, json: async () => body }
  }
  return { impl, calls }
}

const CREDS = {
  baseUrl: "example.atlassian.net",
  email: "a@b.co",
  apiToken: "t",
}

test("normalizeBase adds a scheme when the host is bare", () => {
  // A host-only JIRA_BASE_URL sends every request to a 301 that then fails to
  // parse as JSON — an unhelpful way to learn the scheme was missing.
  expect(normalizeBase("example.atlassian.net")).toBe(
    "https://example.atlassian.net",
  )
  expect(normalizeBase("https://example.atlassian.net")).toBe(
    "https://example.atlassian.net",
  )
  expect(normalizeBase("http://localhost:8080")).toBe("http://localhost:8080")
})

test("normalizeBase strips trailing slashes and surrounding space", () => {
  expect(normalizeBase("  example.atlassian.net/  ")).toBe(
    "https://example.atlassian.net",
  )
  expect(normalizeBase("example.atlassian.net///")).toBe(
    "https://example.atlassian.net",
  )
})

test("normalizeBase rejects an empty site", () => {
  expect(() => normalizeBase("")).toThrow(/JIRA_BASE_URL/)
  expect(() => normalizeBase("   ")).toThrow(/JIRA_BASE_URL/)
})

test("jqlCount posts the query to the approximate-count endpoint", async () => {
  // /rest/api/3/search was removed by Atlassian (410) and its replacement
  // returns token-paginated issues with no total, so counts must come here.
  const { impl, calls } = fakeFetch({ count: 67 })
  const n = await jqlCount("assignee = currentUser()", {
    ...CREDS,
    fetchImpl: impl,
  })
  expect(n).toBe(67)
  expect(calls[0]?.url).toBe(
    "https://example.atlassian.net/rest/api/3/search/approximate-count",
  )
  expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
    jql: "assignee = currentUser()",
  })
})

test("jqlCount requires credentials", async () => {
  await expect(jqlCount("x", { baseUrl: "e.atlassian.net" })).rejects.toThrow(
    /JIRA_EMAIL/,
  )
  await expect(
    jqlCount("x", { baseUrl: "e.atlassian.net", email: "a@b.co" }),
  ).rejects.toThrow(/JIRA_API_TOKEN/)
})

test("jqlCount surfaces Jira's own error message", async () => {
  const { impl } = fakeFetch(
    {
      errorMessages: [
        "The max results parameter has to be between 1 and 5,000.",
      ],
    },
    { ok: false, status: 400 },
  )
  await expect(jqlCount("x", { ...CREDS, fetchImpl: impl })).rejects.toThrow(
    /HTTP 400 — The max results/,
  )
})

test("jqlCount reports a bare status when Jira says nothing useful", async () => {
  const { impl } = fakeFetch({}, { ok: false, status: 401 })
  await expect(jqlCount("x", { ...CREDS, fetchImpl: impl })).rejects.toThrow(
    /HTTP 401/,
  )
})

test("jqlCount treats a missing count as zero", async () => {
  const { impl } = fakeFetch({})
  expect(await jqlCount("x", { ...CREDS, fetchImpl: impl })).toBe(0)
})

test("issueNavigatorUrl builds a browsable query link", () => {
  expect(
    issueNavigatorUrl("example.atlassian.net", "assignee = currentUser()"),
  ).toBe(
    "https://example.atlassian.net/issues/?jql=assignee%20%3D%20currentUser()",
  )
})

test("countState flips at the threshold", () => {
  expect(countState(0)).toBe(0)
  expect(countState(1)).toBe(1)
  expect(countState(5, 10)).toBe(0)
  expect(countState(10, 10)).toBe(1)
})
