import { expect, test } from "vite-plus/test"
import type { Account } from "./cswap"
import {
  accountLabel,
  escapeXml,
  reading,
  renderError,
  renderSvg,
  severity,
  svgDataUri,
} from "./render"

const PERSONAL: Account = {
  number: 1,
  email: "sam@example.org",
  organizationName: "sam@example.org's Organization",
  active: true,
  usageStatus: "ok",
  usage: {
    fiveHour: { pct: 1, countdown: "4h 25m", clock: "20:00" },
    sevenDay: { pct: 6, countdown: "5d 8h", clock: "Aug 9 00:00" },
  },
}

const WORK: Account = {
  number: 2,
  email: "sam@acme.dev",
  organizationName: "Acme Works",
  active: false,
  usageStatus: "ok",
  usage: {
    fiveHour: { pct: 35, countdown: "1h 15m", clock: "16:50" },
    sevenDay: { pct: 50, countdown: "4d 7h", clock: "Aug 7 23:00" },
    spend: { used: 9.24, limit: 500, pct: 1.848, currency: "USD" },
  },
}

test("the label is the email domain, which is what actually differs", () => {
  // Both accounts share a local part, so "sam" would name neither of them.
  expect(accountLabel(PERSONAL)).toBe("example")
  expect(accountLabel(WORK)).toBe("acme")
})

test("a label override wins, and long names are trimmed to fit", () => {
  expect(accountLabel(PERSONAL, { "sam@example.org": "personal" })).toBe(
    "personal",
  )
  expect(
    accountLabel(PERSONAL, { "sam@example.org": "a".repeat(40) }),
  ).toHaveLength(14)
})

test("an override can be keyed by slot number instead of email", () => {
  // So a config in a public repo can rename a bar without publishing an
  // address — which is exactly what this repo's own layout.ts does.
  expect(accountLabel(PERSONAL, { "1": "personal" })).toBe("personal")
  expect(accountLabel(WORK, { "1": "personal", "2": "work" })).toBe("work")
  // Unlisted accounts still fall back to the derived name.
  expect(accountLabel(WORK, { "1": "personal" })).toBe("acme")
})

test("email wins over slot number, since it survives reordering", () => {
  expect(
    accountLabel(PERSONAL, {
      "sam@example.org": "by-email",
      "1": "by-slot",
    }),
  ).toBe("by-email")
})

test("severity climbs blue -> amber -> red as the window fills", () => {
  expect(severity(0)).toBe("#3B82F6")
  expect(severity(49)).toBe("#3B82F6")
  expect(severity(50)).toBe("#F59E0B")
  expect(severity(79)).toBe("#F59E0B")
  expect(severity(80)).toBe("#EF4444")
  expect(severity(100)).toBe("#EF4444")
})

test("reading picks the selected window and carries its reset", () => {
  expect(reading(PERSONAL, "fiveHour")).toEqual({
    pct: 1,
    value: "1%",
    countdown: "4h 25m",
  })
  expect(reading(WORK, "sevenDay")).toEqual({
    pct: 50,
    value: "50%",
    countdown: "4d 7h",
  })
})

test("spend reads as money, because dollars mean more than a percentage", () => {
  // The bar still shows the share of the cap; the text says what was spent.
  expect(reading(WORK, "spend")).toEqual({ pct: 1.848, value: "$9.24" })
})

test("a missing limit shows a dash and no bar, never a zero", () => {
  // A zero-width bar and a 0% bar look identical but mean opposite things:
  // "you have no spend cap" versus "you have spent nothing".
  const noSpend = reading(PERSONAL, "spend")
  expect(noSpend.pct).toBeUndefined()
  expect(noSpend.value).toBe("—")
})

test("a broken account says why, in a word that names the fix", () => {
  const expired: Account = {
    ...PERSONAL,
    usageStatus: "token_expired",
    usage: undefined,
  }
  expect(reading(expired, "fiveHour")).toEqual({ value: "expired" })

  const locked: Account = {
    ...PERSONAL,
    usageStatus: "keychain_unavailable",
    usage: undefined,
  }
  expect(reading(locked, "fiveHour")).toEqual({ value: "locked" })

  const unknown: Account = {
    ...PERSONAL,
    usageStatus: "unavailable",
    usage: undefined,
  }
  expect(reading(unknown, "fiveHour")).toEqual({ value: "n/a" })
})

test("escapeXml keeps markup out of labels that came from an email", () => {
  expect(escapeXml('a&b<c>"d"')).toBe("a&amp;b&lt;c&gt;&quot;d&quot;")
})

test("the strip draws a row per account, marking the active one", () => {
  const svg = renderSvg([PERSONAL, WORK], "fiveHour")
  expect(svg).toContain("example")
  expect(svg).toContain("acme")
  expect(svg).toContain("5H WINDOW")
  // The active account gets a filled dot; the other an outlined one.
  expect(svg).toContain('r="4.5" fill="#FFFFFF"')
  expect(svg).toContain('fill="none" stroke="#6B7280"')
  // Its reset is the one worth showing, since it's the quota being spent.
  expect(svg).toContain("4h 25m")
})

/** Widths of the bar rects only — the full-canvas background isn't one. */
function barWidths(svg: string): number[] {
  return [...svg.matchAll(/<rect x="19" y="[\d.]+" width="([\d.]+)"/g)].map(
    (match) => Number(match[1]),
  )
}

test("bar width tracks the percentage and never leaves the canvas", () => {
  const half = renderSvg(
    [{ ...PERSONAL, usage: { fiveHour: { pct: 50 } } }],
    "fiveHour",
  )
  // The track, then half of it — 175px between the gutter and right margin.
  expect(barWidths(half)).toEqual([175, 87.5])

  // A window reported over 100% must clamp to the track, not overhang it.
  const over = renderSvg(
    [{ ...PERSONAL, usage: { fiveHour: { pct: 140 } } }],
    "fiveHour",
  )
  expect(barWidths(over)).toEqual([175, 175])
})

test("every row stays inside the 200x100 strip, whatever the account count", () => {
  const accounts = [PERSONAL, WORK, { ...WORK, number: 3, email: "c@third.io" }]
  for (const count of [1, 2, 3]) {
    const svg = renderSvg(accounts.slice(0, count), "fiveHour")
    const rects = [
      ...svg.matchAll(
        /<rect x="19" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g,
      ),
    ]
    expect(rects.length, `${count} accounts`).toBeGreaterThan(0)
    for (const [, y, h] of rects) {
      expect(Number(y) + Number(h), `${count} accounts`).toBeLessThanOrEqual(
        100,
      )
    }
  }
})

test("the error strip names cswap and shows the reason", () => {
  const svg = renderError("cswap did not return JSON")
  expect(svg).toContain("cswap")
  expect(svg).toContain("did not return JSON")
  expect(svg).toContain("#EF4444")
})

test("feedback is a base64 SVG data URI, as the layout's pixmap expects", () => {
  const uri = svgDataUri("<svg/>")
  expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true)
  expect(
    Buffer.from(
      uri.replace("data:image/svg+xml;base64,", ""),
      "base64",
    ).toString(),
  ).toBe("<svg/>")
})
