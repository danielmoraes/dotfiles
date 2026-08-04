/**
 * What a session key shows.
 *
 * Pure — a `Slot` in, SVG out — so the layout is tested by asserting on markup
 * rather than by looking at hardware.
 *
 * **The pixel budget is the whole point of this plugin.** AgentDeck's own slot
 * spends a quarter of the key on a Claude watermark, states the same state
 * three times (border colour, badge pill, and the word `RUNNING`), and then
 * truncates the one identity field to 13 characters — of a name that is the
 * worktree slug rather than the repo. So here: state lives *only* in the border
 * colour, and the space that buys goes to the repo, the worktree, how far
 * through its context window the session is, and how long it has been running.
 */

import { elapsedLabel, headingOf, type Slot } from "./session"

/** Keys are 72x72 points; the @2x canvas every deck actually renders is 144. */
const SIZE = 144
/**
 * The inner panel — geometry only, no fill: it's the path the state border is
 * drawn on, inset far enough that the border has somewhere to live.
 */
const PANEL = { x: 8, y: 8, w: 128, h: 128, r: 12 }
/**
 * Length of the panel's rounded-rect outline: four straights of (128 - 2*12)
 * plus one full circle of radius 12. Dash patterns are in user units, so the
 * orbit only closes cleanly if this is right.
 */
const PERIMETER = 4 * (PANEL.w - 2 * PANEL.r) + 2 * Math.PI * PANEL.r

const LEFT = 20
/** Right text edge, mirroring the left gutter. */
const RIGHT = SIZE - LEFT
/**
 * Where the context bar stops.
 *
 * The percentage is right-aligned into the column after it, and that column has
 * to fit the widest reading — not `87%` but `181%`, because context can exceed
 * 100 once compaction is in play. Four characters at 12px semibold is ~30px,
 * plus a gap. Sizing this to a two-digit reading is what put the bar under the
 * number the first time.
 *
 * Fixed rather than derived from the label: all seven bars are the same length,
 * so they can be compared across keys at a glance.
 */
const BAR_RIGHT = RIGHT - 36

/**
 * The four rows, as text baselines (the bar is a rect, so `bar` is its top).
 *
 * Kept in one place because the whole key is a vertical rhythm and the rows
 * only look right relative to each other. The first cut left a 30px hole
 * between the second line and the bar — the rows had been placed one at a time
 * rather than spaced against each other.
 */
const ROW = { heading: 44, sub: 66, bar: 86, foot: 122 }
/** Bar thickness. */
const BAR_H = 7

/**
 * Black, like Elgato's own built-in keys.
 *
 * The first cut used a near-black card (#16191F) on a slightly lighter panel
 * (#1F242C), which looked considered on its own and looked *grey* next to the
 * built-in "Work ▶" key sitting beside it on the same deck. Black also buys
 * real contrast: the dimmest text on the key goes from ~5.5:1 against the old
 * panel to ~7.7:1 here.
 */
const BG = "#000000"
const WHITE = "#FFFFFF"
/**
 * Secondary text.
 *
 * Deliberately bright. The first cut used a mid grey (#6B7280), which is a fine
 * "quiet" colour on a white page and unreadable on a dark key seen from arm's
 * length across a lit desk. Secondary here means "smaller and later", not
 * "faded".
 */
const SUB = "#C6D0DC"
/** Tertiary — the one thing allowed to recede, since it's the least useful. */
const FAINT = "#93A1B2"
const TRACK = "#2A2F3A"

/** Bar colours, the same ladder the cswap dial uses: blue quiet, red loud. */
const QUIET = "#3B82F6"
const WARN = "#F59E0B"
const ALERT = "#EF4444"

/** Running is teal — cool, and deliberately not the amber that means "you". */
const RUNNING = "#2DD4BF"

/** Pixels the orbiting dash travels per animation frame. */
const ORBIT_SPEED = 6
/** How much of the perimeter the travelling dash covers. */
const ORBIT_DASH = 120

export function severity(pct: number): string {
  if (pct >= 80) {
    return ALERT
  }
  if (pct >= 50) {
    return WARN
  }
  return QUIET
}

/** SVG is XML, and repo names come off the filesystem. */
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * Clip to what fits, with an ellipsis when something was cut.
 *
 * Character budgets rather than measured text: the deck renders with whatever
 * sans it has, so a measured fit would be a guess with extra steps.
 */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function text(
  x: number,
  y: number,
  value: string,
  { size = 11, fill = WHITE, weight = "400", anchor = "start" } = {},
): string {
  return (
    `<text x="${x}" y="${y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    `${escapeXml(value)}</text>`
  )
}

/**
 * A git-branch glyph, drawn rather than typed.
 *
 * The obvious character for this is U+2442, but the deck renders SVG with
 * whatever fonts it has and an unusual glyph that falls back to tofu would be
 * worse than no marker at all. Six drawn primitives always render.
 *
 * `scale` because the glyph now sits on the 17px heading rather than the 11px
 * line it was drawn for, and a marker built for the small line reads as a
 * smudge beside bold text.
 */
function branchGlyph(x: number, y: number, { scale = 1, colour = FAINT } = {}) {
  const at = (n: number): number => round(n * scale)
  const stroke = `stroke="${colour}" stroke-width="${at(1.4)}" fill="none"`
  return [
    `<path d="M${x} ${y - at(4)} V${y + at(4)}" ${stroke} stroke-linecap="round"/>`,
    `<path d="M${x} ${y} Q${x + at(3)} ${y} ${x + at(5)} ${y - at(3)}" ${stroke} stroke-linecap="round"/>`,
    `<circle cx="${x}" cy="${y + at(5)}" r="${at(1.6)}" fill="${colour}"/>`,
    `<circle cx="${x + at(6)}" cy="${y - at(4)}" r="${at(1.6)}" fill="${colour}"/>`,
  ].join("")
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The state border.
 *
 * Running orbits: a teal dash travelling the perimeter, which reads as work
 * moving. Awaiting breathes: a solid amber ring pulsing in place — a different
 * hue *and* a different motion, so "needs you" can't be mistaken for "busy" in
 * peripheral vision. Idle is a hairline, present only so the key has an edge.
 */
function border(slot: Slot, frame: number): string {
  const rect = (stroke: string, width: number, extra = ""): string =>
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="${PANEL.r}" ` +
    `fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`

  if (slot.state === "running") {
    const offset = round(-((frame * ORBIT_SPEED) % PERIMETER))
    const dash = `stroke-dasharray="${round(ORBIT_DASH)} ${round(PERIMETER - ORBIT_DASH)}" stroke-dashoffset="${offset}" stroke-linecap="round"`
    // Two passes rather than a blur filter: a wide faint stroke under a narrow
    // bright one gives the same glow for a fraction of the render cost, and
    // can't be dropped by a renderer that skips filters.
    return (
      rect(RUNNING, 6, `opacity="0.28" ${dash}`) +
      rect(RUNNING, 2.5, `opacity="0.95" ${dash}`)
    )
  }
  if (slot.state === "awaiting") {
    const breathe = round(0.45 + 0.55 * Math.abs(Math.sin(frame * 0.14)))
    return (
      rect(WARN, 7, `opacity="${round(breathe * 0.35)}"`) +
      rect(WARN, 3, `opacity="0.97"`)
    )
  }
  return rect(TRACK, 1.5, `opacity="0.9"`)
}

/** Context window usage: a bar, and the number beside it. */
function contextRow(pct: number): string {
  const y = ROW.bar
  const colour = severity(pct)
  const filled = round(((BAR_RIGHT - LEFT) * Math.min(pct, 100)) / 100)
  return [
    `<rect x="${LEFT}" y="${y}" width="${BAR_RIGHT - LEFT}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${TRACK}"/>`,
    filled > 0
      ? `<rect x="${LEFT}" y="${y}" width="${filled}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${colour}"/>`
      : "",
    text(RIGHT, y + BAR_H, `${Math.round(pct)}%`, {
      size: 12,
      fill: colour,
      weight: "600",
      anchor: "end",
    }),
  ].join("")
}

function svg(body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `<rect width="${SIZE}" height="${SIZE}" rx="16" fill="${BG}"/>`,
    body,
    "</svg>",
  ].join("")
}

/**
 * A live session.
 *
 * `frame` advances only while something on the deck is animating; a still key
 * renders the same markup for every frame, so a repaint is cheap and the app
 * de-duplicates it.
 */
export function renderSlot(slot: Slot, frame = 0): string {
  const elapsed = elapsedLabel(slot.elapsedSec)

  return svg(
    [
      border(slot, frame),
      identity(slot),
      slot.contextPercent === undefined ? "" : contextRow(slot.contextPercent),
      footer(elapsed, slot.startedAt),
    ].join(""),
  )
}

/**
 * The bottom row: how long it has been running, and when it started.
 *
 * Pinned to the two gutters — elapsed against `LEFT`, the clock time against
 * `RIGHT` — so the row is padded the same on both sides and lines up with the
 * context percentage sitting above it. An attempt at flowing the clock time
 * inline after the elapsed label had to guess that label's width from its
 * character count, and bought a ragged right edge for the trouble.
 */
function footer(elapsed: string | undefined, startedAt: string | undefined) {
  return (
    (elapsed === undefined
      ? ""
      : text(LEFT, ROW.foot, elapsed, {
          size: 16,
          fill: SUB,
          weight: "600",
        })) +
    (startedAt === undefined
      ? ""
      : text(RIGHT, ROW.foot, startedAt, {
          size: 12,
          fill: FAINT,
          anchor: "end",
        }))
  )
}

/**
 * The two identity lines: which session, then where it lives.
 *
 * **The bottom line is always the repo.** It used to be the repo on a named
 * session and the worktree slug on an unnamed one, which meant the same
 * position on two adjacent keys answered two different questions and a column
 * of keys couldn't be read down. Now the repo holds that line on every key, and
 * the deck sorts on it (see `order`), so sessions of one repo are a block with
 * one word repeated down its second line.
 *
 * That leaves the top line for whatever distinguishes this session *within* its
 * repo: the name you set with `/rename` if there is one, otherwise the worktree
 * slug, marked with a branch glyph because that's what it is.
 *
 * The exception is the one case with nothing to distinguish — an unnamed
 * session in a plain checkout. There the repo takes the top line alone rather
 * than being printed on the key twice.
 */
function identity(slot: Slot): string {
  const marked = slot.name === undefined && slot.worktree !== undefined
  const value = headingOf(slot)
  // A slug heading gets 8 characters where a name gets 11: the glyph in front
  // of it costs about 15px, a character and a half at this size.
  //
  // Sized tighter than the 11 rather than merely proportionally, because the
  // two budgets are estimating different things. A name is short and usually
  // arrives whole, so 11 can assume average-width characters. Every worktree
  // slug is three words long and *always* truncates, so this one has to hold
  // for the wide end of the alphabet: at 17px bold an `m` is 0.89em against
  // the ~0.55em the estimate assumes, and `calm-mapping-twilight` at 9 ran
  // seven pixels past the right gutter that the percentage and clock line up
  // against. Shrinking the slug instead would put a third font size on a key
  // that has two, and the first word is what tells two worktrees apart anyway.
  const heading = marked
    ? branchGlyph(LEFT + 4, ROW.heading - 6, { scale: 1.4, colour: SUB }) +
      text(LEFT + 15, ROW.heading, truncate(value, 8), {
        size: 17,
        weight: "700",
      })
    : text(LEFT, ROW.heading, truncate(value, 11), { size: 17, weight: "700" })

  // The repo is an identity field, not a detail, so it gets a readable size
  // rather than the smallest one that fits.
  const under =
    slot.name === undefined && slot.worktree === undefined
      ? ""
      : text(LEFT, ROW.sub, truncate(slot.repo, 15), { size: 13, fill: SUB })

  return heading + under
}

/**
 * A slot with no session behind it.
 *
 * Deliberately near-empty: seven keys of "no session" would shout louder than
 * the two that have one.
 */
export function renderEmpty(): string {
  return svg(
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="${PANEL.r}" fill="none" stroke="${TRACK}" stroke-width="1.5" opacity="0.5"/>` +
      `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="3" fill="${TRACK}"/>`,
  )
}

/** Keys take an image, and base64 is the form Elgato's own schema documents. */
export function svgDataUri(markup: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(markup, "utf8").toString("base64")}`
}
