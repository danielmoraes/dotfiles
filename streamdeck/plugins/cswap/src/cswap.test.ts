import { expect, test } from "vite-plus/test"
import { type Exec, listAccounts, switchAccount } from "./cswap"

/** A trimmed copy of a real `cswap --list --json`, shapes intact. */
const LIST = {
  schemaVersion: 1,
  activeAccountNumber: 1,
  accounts: [
    {
      number: 1,
      email: "sam@example.org",
      organizationName: "sam@example.org's Organization",
      active: true,
      usageStatus: "ok",
      usage: {
        fiveHour: { pct: 1.0, countdown: "4h 25m", clock: "20:00" },
        sevenDay: { pct: 6.0, countdown: "5d 8h", clock: "Aug 9 00:00" },
        scoped: [{ pct: 0.0, name: "Fable" }],
      },
    },
    {
      number: 2,
      email: "sam@acme.dev",
      organizationName: "Acme Works",
      active: false,
      usageStatus: "ok",
      usage: {
        fiveHour: { pct: 35.0, countdown: "1h 15m", clock: "16:50" },
        sevenDay: { pct: 50.0, countdown: "4d 7h", clock: "Aug 7 23:00" },
        spend: { used: 9.24, limit: 500.0, pct: 1.848, currency: "USD" },
      },
    },
  ],
}

function fakeExec(payload: unknown): { impl: Exec; calls: string[][] } {
  const calls: string[][] = []
  const impl: Exec = (args) => {
    calls.push([...args])
    return typeof payload === "string" ? payload : JSON.stringify(payload)
  }
  return { impl, calls }
}

test("listAccounts reads every account, its usage and which is active", () => {
  const { impl, calls } = fakeExec(LIST)
  const accounts = listAccounts(impl)

  expect(calls[0]).toEqual(["--list", "--json"])
  expect(accounts).toHaveLength(2)
  expect(accounts[0]?.email).toBe("sam@example.org")
  expect(accounts[0]?.active).toBe(true)
  expect(accounts[0]?.usage?.fiveHour).toEqual({
    pct: 1,
    countdown: "4h 25m",
    clock: "20:00",
  })
  expect(accounts[1]?.active).toBe(false)
  expect(accounts[1]?.usage?.spend?.used).toBe(9.24)
})

test("accounts without a spend cap or a scoped window simply lack them", () => {
  // Only some plans carry these; absent must stay absent rather than become 0,
  // which the strip would otherwise draw as a real, empty bar.
  const accounts = listAccounts(fakeExec(LIST).impl)
  expect(accounts[0]?.usage?.spend).toBeUndefined()
  expect(accounts[0]?.usage?.scoped).toEqual([{ pct: 0, name: "Fable" }])
  expect(accounts[1]?.usage?.scoped).toBeUndefined()
})

test("a non-ok account keeps its reason and carries no usage", () => {
  const { impl } = fakeExec({
    accounts: [
      {
        number: 1,
        email: "a@b.c",
        active: true,
        usageStatus: "token_expired",
        usage: null,
      },
    ],
  })
  const [account] = listAccounts(impl)
  expect(account?.usageStatus).toBe("token_expired")
  expect(account?.usage).toBeUndefined()
})

test("an unknown status degrades to unavailable rather than being trusted", () => {
  // A future cswap may add states this build has never heard of; they must land
  // on the "no usage" rendering, not flow through as an unchecked string.
  const { impl } = fakeExec({
    accounts: [
      { number: 1, email: "a@b.c", active: true, usageStatus: "something_new" },
    ],
  })
  expect(listAccounts(impl)[0]?.usageStatus).toBe("unavailable")
})

test("cswap's structured error is surfaced, even though it exits zero", () => {
  // Handled failures come back as an `error` envelope on a clean exit, so the
  // payload has to be checked rather than the exit code trusted.
  const { impl } = fakeExec({
    schemaVersion: 1,
    error: { type: "ClaudeSwitchError", message: "keychain unavailable" },
  })
  expect(() => listAccounts(impl)).toThrow(/keychain unavailable/)
})

test("non-JSON output and empty account lists are rejected", () => {
  expect(() => listAccounts(fakeExec("not json at all").impl)).toThrow(/JSON/)
  expect(() => listAccounts(fakeExec({ accounts: [] }).impl)).toThrow(
    /no accounts/,
  )
  expect(() => listAccounts(fakeExec({}).impl)).toThrow(/no accounts/)
})

test("malformed account rows are dropped, not allowed to break the strip", () => {
  const { impl } = fakeExec({
    accounts: [
      { number: 1, email: "a@b.c", active: true, usageStatus: "ok", usage: {} },
      { email: "missing-number@b.c" },
      null,
    ],
  })
  expect(listAccounts(impl)).toHaveLength(1)
})

test("switching rotates by default and defers to cswap for the strategies", () => {
  const rotate = fakeExec({ switched: true })
  switchAccount("rotate", rotate.impl)
  expect(rotate.calls[0]).toEqual(["--switch", "--json"])

  const best = fakeExec({ switched: true })
  switchAccount("best", best.impl)
  expect(best.calls[0]).toEqual(["--switch", "--json", "--strategy", "best"])
})

test("a failed switch throws so the dial can show an alert", () => {
  const { impl } = fakeExec({ error: { message: "no other account" } })
  expect(() => switchAccount("rotate", impl)).toThrow(/no other account/)
})
