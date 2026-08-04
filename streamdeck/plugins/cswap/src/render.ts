/**
 * What the touch strip shows: one row per Claude account, the active one
 * marked, each with a bar for the window currently selected.
 *
 * Everything here is pure — accounts in, SVG out — so the layout can be tested
 * by asserting on the markup rather than by looking at hardware.
 *
 * **Why SVG at all**, when every key in this repo is a pre-authored image plus
 * `setTitle`: a dial has no `States` to switch between and no title to set. The
 * LCD strip is drawn only through `setFeedback`, and its one full-canvas
 * `pixmap` item takes an image — so a dial that shows live values has to
 * generate one. Both third-party dials on this deck (AgentDeck, AI Usage
 * Limits) do exactly the same thing.
 */

import type { Account } from "./cswap"

/** The window the dial is showing; rotating the dial cycles these. */
export type Metric = "fiveHour" | "sevenDay" | "spend"

/**
 * Cycle order, matching the way the limits are usually read: soonest first.
 *
 * Typed as a non-empty tuple so `METRICS[0]` is a `Metric` rather than a
 * maybe-undefined — the cycle can't be empty, and saying so in the type saves
 * every caller a fallback.
 */
export const METRICS: readonly [Metric, ...Metric[]] = [
  "fiveHour",
  "sevenDay",
  "spend",
]

const METRIC_LABELS: Record<Metric, string> = {
  fiveHour: "5H WINDOW",
  sevenDay: "7D WINDOW",
  spend: "SPEND",
}

/**
 * Why an account shows no bar, in the fewest words that still distinguish the
 * cases — a locked Keychain and an expired token need different fixes.
 */
const STATUS_WORDS: Record<string, string> = {
  token_expired: "expired",
  api_key: "api key",
  keychain_unavailable: "locked",
  no_credentials: "no login",
  unavailable: "n/a",
}

/** The strip is 200x100 logical pixels, fixed by the hardware. */
const WIDTH = 200
const HEIGHT = 100
/** Everything below the header belongs to the account rows. */
const HEADER_H = 24
/** Left gutter holds the active-account dot; bars and text start after it. */
const GUTTER = 19
const RIGHT = 194

/**
 * Black, for the same reason the session keys are: the strip is one LCD split
 * between four dials, and the three beside this one are drawn by the app itself
 * against black. A near-black card (#16191F) looked considered on its own and
 * read as a grey rectangle sitting in that row. Black also buys contrast — the
 * dimmest text goes from ~3.6:1 against the old card to ~4.3:1, and the empty
 * part of each bar's track from ~1.3:1 to ~1.6:1.
 */
const BG = "#000000"
const DIM = "#6B7280"
const TRACK = "#2A2F3A"
const WHITE = "#FFFFFF"

/**
 * Bar colours, extending the deck's own vocabulary — blue is quiet, red needs
 * attention, amber is the middle the calendar key already uses for "soon".
 * A gauge earns the third step that a binary count key doesn't.
 */
const QUIET = "#3B82F6"
const WARN = "#F59E0B"
const ALERT = "#EF4444"

export function severity(pct: number): string {
  if (pct >= 80) {
    return ALERT
  }
  if (pct >= 50) {
    return WARN
  }
  return QUIET
}

/** SVG is XML: labels come from account emails, so they can't go in raw. */
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * A short name for the account.
 *
 * The email's domain is what actually distinguishes accounts in practice —
 * every one of them tends to share a local part ("you@…"), while the
 * organisation name is auto-generated boilerplate ("…'s Organization") for
 * personal accounts. `labels` overrides the derived word when it isn't the one
 * you think in.
 *
 * An override may be keyed by **email or by cswap slot number**. Email is the
 * more robust key — it survives accounts being reordered — but the number
 * exists so a config that lives in a public repo doesn't have to publish an
 * address to rename a bar. Email wins when both are present.
 */
export function accountLabel(
  account: Account,
  labels: Record<string, string> = {},
): string {
  const override = labels[account.email] ?? labels[String(account.number)]
  if (override !== undefined && override !== "") {
    return override.slice(0, 14)
  }
  const domain = account.email.split("@")[1]?.split(".")[0]
  const derived = domain ?? account.email.split("@")[0] ?? account.email
  return derived.slice(0, 14)
}

/** Compact money, so `$9.24 / $500` fits beside a name on a 200px strip. */
function money(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : `${currency} `
  const rounded =
    amount >= 100 ? Math.round(amount).toString() : amount.toFixed(2)
  return `${symbol}${rounded}`
}

/** One account's value for the selected metric. */
export type Reading = {
  /** Bar fill, 0..100. Absent when this account has no such limit. */
  pct?: number
  /** The right-hand value: a percentage, an amount, or why there isn't one. */
  value: string
  /** Countdown to this window's reset, when the source reports one. */
  countdown?: string
}

export function reading(account: Account, metric: Metric): Reading {
  if (account.usageStatus !== "ok" || !account.usage) {
    return { value: STATUS_WORDS[account.usageStatus] ?? "n/a" }
  }
  if (metric === "spend") {
    const spend = account.usage.spend
    // Only some plans carry a spend cap; a dash beats inventing a zero.
    return spend
      ? { pct: spend.pct, value: money(spend.used, spend.currency) }
      : { value: "—" }
  }
  const window = account.usage[metric]
  if (!window) {
    return { value: "—" }
  }
  return {
    pct: window.pct,
    value: `${Math.round(window.pct)}%`,
    countdown: window.countdown,
  }
}

function text(
  x: number,
  y: number,
  value: string,
  { size = 14, fill = WHITE, anchor = "start", weight = "400" } = {},
): string {
  return (
    `<text x="${x}" y="${y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    `${escapeXml(value)}</text>`
  )
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export type RenderOptions = {
  labels?: Record<string, string>
}

/**
 * The whole strip.
 *
 * Tuned for two accounts — the row geometry is derived from the count, so three
 * or four still render (tighter) rather than overflowing the canvas.
 */
export function renderSvg(
  accounts: readonly Account[],
  metric: Metric,
  { labels = {} }: RenderOptions = {},
): string {
  const rows: string[] = []
  const rowH = (HEIGHT - HEADER_H) / Math.max(accounts.length, 1)
  const size = Math.min(Math.max(rowH * 0.37, 8), 14)
  const barH = Math.min(Math.max(rowH * 0.16, 4), 6)

  accounts.forEach((account, index) => {
    const top = HEADER_H + index * rowH
    const baseline = round(top + rowH * 0.42)
    const barY = round(top + rowH * 0.55)
    const { pct, value } = reading(account, metric)
    const colour = pct === undefined ? TRACK : severity(pct)

    // The active account is marked twice over — a filled dot and a white name
    // against the others' grey — because "which one am I on" is the question
    // the dial exists to answer, and it has to survive a glance.
    rows.push(
      account.active
        ? `<circle cx="9" cy="${round(top + rowH * 0.3)}" r="4.5" fill="${WHITE}"/>`
        : `<circle cx="9" cy="${round(top + rowH * 0.3)}" r="4" fill="none" stroke="${DIM}" stroke-width="1.5"/>`,
      text(GUTTER, baseline, accountLabel(account, labels), {
        size,
        fill: account.active ? WHITE : DIM,
        weight: account.active ? "600" : "400",
      }),
      text(RIGHT, baseline, value, {
        size,
        fill: pct === undefined ? DIM : colour,
        anchor: "end",
        weight: "600",
      }),
      `<rect x="${GUTTER}" y="${barY}" width="${RIGHT - GUTTER}" height="${round(barH)}" rx="${round(barH / 2)}" fill="${TRACK}"/>`,
    )
    if (pct !== undefined && pct > 0) {
      // Clamp: a bar wider than its track would spill past the canvas edge.
      const filled = round(((RIGHT - GUTTER) * Math.min(pct, 100)) / 100)
      rows.push(
        `<rect x="${GUTTER}" y="${barY}" width="${filled}" height="${round(barH)}" rx="${round(barH / 2)}" fill="${colour}"/>`,
      )
    }
  })

  // The header carries the reset for the account you're actually spending, so
  // the countdown belongs to the active row even though it sits up top.
  const active = accounts.find((account) => account.active)
  const countdown = active ? reading(active, metric).countdown : undefined

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>`,
    text(6, 15, METRIC_LABELS[metric], { size: 11, fill: DIM, weight: "600" }),
    countdown
      ? text(RIGHT, 15, countdown, { size: 11, fill: DIM, anchor: "end" })
      : "",
    ...rows,
    "</svg>",
  ].join("")
}

/** A whole-canvas message, for when cswap can't be read at all. */
export function renderError(message: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>`,
    text(WIDTH / 2, 40, "cswap", {
      size: 15,
      fill: ALERT,
      anchor: "middle",
      weight: "600",
    }),
    text(WIDTH / 2, 62, message.slice(0, 30), {
      size: 11,
      fill: DIM,
      anchor: "middle",
    }),
    "</svg>",
  ].join("")
}

/**
 * Wrap SVG markup as a data URI.
 *
 * The layout's `pixmap` item takes an image, and base64 is the form Elgato's
 * own schema documents — safer than handing the app raw markup with quotes and
 * `#` in it.
 */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
}
