import {
  type Canvas,
  type Rgb,
  type Sdf,
  circle,
  rgb,
  ring,
  roundedRect,
  segment,
  union,
} from "./canvas.ts"

/**
 * The plugin icons, one per custom plugin in this repo.
 *
 * Each is a solid accent plate with a white mark. Accents follow the category
 * convention in `../README.md` — work/status is blue, modes/metrics green — so
 * a plugin's icon matches the deck page its keys live on.
 */

const WHITE = rgb("#FFFFFF")
const BLUE = rgb("#3B82F6")
const GREEN = rgb("#22C55E")
const RED = rgb("#EF4444")
const PURPLE = rgb("#8B7BE8")

/**
 * Marks are authored in a 0..1 "mark space" and inset into the plate, so the
 * glyph keeps a consistent optical margin no matter which mark it is.
 */
const INSET = 0.22
const SPAN = 1 - INSET * 2
const m = (u: number): number => INSET + u * SPAN
/** Widths/radii are in mark space too, so they scale with the inset. */
const w = (u: number): number => u * SPAN

/** Union of segments through consecutive points, with round joins. */
function path(points: readonly [number, number][], width: number): Sdf {
  const links = points.slice(1).map((p, i) => {
    const prev = points[i]!
    return segment(prev[0], prev[1], p[0], p[1], width)
  })
  return union(...links)
}

/** Sample a quadratic bezier so curves can reuse `path`. */
function quad(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  steps = 12,
): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const u = 1 - t
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]
  })
}

function plate(canvas: Canvas, color: Rgb): void {
  canvas.fill(roundedRect(0.5, 0.5, 0.5, 0.5, 0.235), color)
}

export type Mark = {
  /** Output directory name — matches the plugin's `.sdPlugin` folder. */
  plugin: string
  draw: (canvas: Canvas) => void
}

/** github-stats: a git-branch glyph (PR/CI counts). */
function githubStats(canvas: Canvas): void {
  plate(canvas, BLUE)
  const stroke = w(0.13)
  const node = w(0.135)
  canvas.fill(
    union(
      path(
        [
          [m(0.16), m(0.16)],
          [m(0.16), m(0.84)],
        ],
        stroke,
      ),
      path(
        quad([m(0.16), m(0.52)], [m(0.62), m(0.52)], [m(0.84), m(0.26)]),
        stroke,
      ),
      circle(m(0.16), m(0.14), node),
      circle(m(0.16), m(0.86), node),
      circle(m(0.84), m(0.18), node),
    ),
    WHITE,
  )
}

/** slack-unread: a channel hash with an unread badge. */
function slackUnread(canvas: Canvas): void {
  plate(canvas, BLUE)
  const stroke = w(0.13)
  canvas.fill(
    union(
      path(
        [
          [m(0.02), m(0.36)],
          [m(0.9), m(0.36)],
        ],
        stroke,
      ),
      path(
        [
          [m(0.1), m(0.68)],
          [m(0.98), m(0.68)],
        ],
        stroke,
      ),
      path(
        [
          [m(0.38), m(0.02)],
          [m(0.26), m(1.02)],
        ],
        stroke,
      ),
      path(
        [
          [m(0.74), m(0.02)],
          [m(0.62), m(1.02)],
        ],
        stroke,
      ),
    ),
    WHITE,
  )
  // Unread badge: punch a plate-coloured gap so the dot reads as an overlay.
  canvas.fill(circle(m(0.94), m(0.06), w(0.28)), BLUE)
  canvas.fill(circle(m(0.94), m(0.06), w(0.2)), RED)
}

/** weekly-metrics: ascending bars. */
function weeklyMetrics(canvas: Canvas): void {
  plate(canvas, GREEN)
  const half = w(0.09)
  const base = m(0.9)
  const bar = (cx: number, top: number): Sdf => {
    const t = m(top)
    return roundedRect(m(cx), (t + base) / 2, half, (base - t) / 2, half)
  }
  canvas.fill(union(bar(0.15, 0.6), bar(0.5, 0.34), bar(0.85, 0.08)), WHITE)
}

/** calendar: a month grid with the header bar filled. */
function calendar(canvas: Canvas): void {
  plate(canvas, BLUE)
  const stroke = w(0.1)
  const body = roundedRect(m(0.5), m(0.56), w(0.46), w(0.4), w(0.09))
  canvas.fill(body, WHITE)
  // Punch the page out of the frame, then lay the header band back over it.
  canvas.fill(
    roundedRect(m(0.5), m(0.6), w(0.46) - stroke, w(0.4) - stroke, w(0.05)),
    BLUE,
  )
  canvas.fill(
    union(
      path(
        [
          [m(0.06), m(0.3)],
          [m(0.94), m(0.3)],
        ],
        stroke * 1.6,
      ),
      // Binder rings.
      path(
        [
          [m(0.3), m(0.06)],
          [m(0.3), m(0.2)],
        ],
        stroke,
      ),
      path(
        [
          [m(0.7), m(0.06)],
          [m(0.7), m(0.2)],
        ],
        stroke,
      ),
    ),
    WHITE,
  )
}

/** commands: a shell prompt chevron. */
function commands(canvas: Canvas): void {
  plate(canvas, PURPLE)
  const stroke = w(0.13)
  canvas.fill(
    union(
      path(
        [
          [m(0.1), m(0.14)],
          [m(0.52), m(0.45)],
          [m(0.1), m(0.76)],
        ],
        stroke,
      ),
      path(
        [
          [m(0.6), m(0.78)],
          [m(0.95), m(0.78)],
        ],
        stroke,
      ),
    ),
    WHITE,
  )
}

/** jira: a stack of issue rows. */
function jira(canvas: Canvas): void {
  plate(canvas, BLUE)
  const h = w(0.15)
  canvas.fill(
    union(
      roundedRect(m(0.5), m(0.22), w(0.46), h, h * 0.55),
      roundedRect(m(0.5), m(0.78), w(0.46), h, h * 0.55),
    ),
    WHITE,
  )
}

/** cswap: two accounts' usage bars, the active one marked by a filled dot. */
function cswap(canvas: Canvas): void {
  plate(canvas, PURPLE)
  const barH = w(0.09)
  // Bars of different lengths carry the whole idea — two accounts, each some
  // way through its quota — without needing a second colour on a white mark.
  const bar = (cy: number, end: number): Sdf => {
    const x0 = m(0.26)
    const x1 = m(end)
    return roundedRect((x0 + x1) / 2, m(cy), (x1 - x0) / 2, barH, barH)
  }
  canvas.fill(union(circle(m(0.06), m(0.24), w(0.11)), bar(0.24, 0.62)), WHITE)
  canvas.fill(
    union(ring(m(0.06), m(0.76), w(0.1), w(0.055)), bar(0.76, 1)),
    WHITE,
  )
}

/** sessions: a wall of session slots, one of them live. */
function sessions(canvas: Canvas): void {
  plate(canvas, PURPLE)
  const half = w(0.22)
  const radius = w(0.07)
  const stroke = w(0.085)
  const tile = (cx: number, cy: number, inset = 0): Sdf =>
    roundedRect(
      m(cx),
      m(cy),
      half - inset,
      half - inset,
      inset === 0 ? radius : radius * 0.6,
    )
  canvas.fill(
    union(
      tile(0.24, 0.24),
      tile(0.76, 0.24),
      tile(0.24, 0.76),
      tile(0.76, 0.76),
    ),
    WHITE,
  )
  // Punch three of the four hollow, so one slot reads as the running session —
  // the same "some full, some not" idea the key itself trades on.
  canvas.fill(
    union(
      tile(0.76, 0.24, stroke),
      tile(0.24, 0.76, stroke),
      tile(0.76, 0.76, stroke),
    ),
    PURPLE,
  )
}

export const MARKS: readonly Mark[] = [
  { plugin: "com.dmoraes.sessions", draw: sessions },
  { plugin: "com.dmoraes.jira", draw: jira },
  { plugin: "com.dmoraes.cswap", draw: cswap },
  { plugin: "com.dmoraes.commands", draw: commands },
  { plugin: "com.dmoraes.calendar", draw: calendar },
  { plugin: "com.dmoraes.github-stats", draw: githubStats },
  { plugin: "com.dmoraes.slack-unread", draw: slackUnread },
  { plugin: "com.dmoraes.weekly-metrics", draw: weeklyMetrics },
]
