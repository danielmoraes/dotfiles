import { expect, test } from "vite-plus/test"
import {
  escapeXml,
  renderEmpty,
  renderSlot,
  severity,
  svgDataUri,
  truncate,
} from "./render"
import type { Slot } from "./session"

const RUNNING: Slot = {
  repo: "steward",
  worktree: "calm-mapping-twilight",
  state: "running",
  contextPercent: 87,
  elapsedSec: 21 * 60,
  startedAt: "16:06",
}

test("unnamed: the repo leads and the worktree sits under it", () => {
  const svg = renderSlot(RUNNING)
  expect(svg).toContain(">steward<")
  // 16 characters plus an ellipsis, not AgentDeck's 13-character clip.
  expect(svg).toContain(">calm-mapping-tw…<")
  // The repo gets the big line.
  expect(svg).toMatch(/font-size="17"[^>]*>steward</)
})

test("named: the name leads and the repo sits under it", () => {
  const svg = renderSlot({ ...RUNNING, name: "stream deck" })
  // The name you chose is the identity, so it takes the heading...
  expect(svg).toMatch(/font-size="17"[^>]*>stream deck</)
  // ...and the repo becomes the context line beneath it.
  expect(svg).toMatch(/font-size="11"[^>]*>steward</)
  // The slug is not worth a line once there's a name.
  expect(svg).not.toContain(">calm-mapping-tw…<")
})

test("a named session in a plain checkout still shows its repo", () => {
  const svg = renderSlot({
    ...RUNNING,
    name: "stream deck",
    worktree: undefined,
  })
  expect(svg).toMatch(/font-size="17"[^>]*>stream deck</)
  expect(svg).toMatch(/font-size="11"[^>]*>steward</)
})

test("the terminal rides along, so a key leads back to a window", () => {
  expect(renderSlot({ ...RUNNING, terminal: "s002" })).toContain(">s002<")
  expect(renderSlot(RUNNING)).not.toContain(">s002<")
})

test("the key spends no pixels restating the state as a word", () => {
  const svg = renderSlot(RUNNING)
  for (const word of ["RUNNING", "IDLE", "PERMIT", "RUN", "ACT"]) {
    expect(svg, `state restated as "${word}"`).not.toContain(`>${word}<`)
  }
})

test("state reads off the border colour alone", () => {
  // Teal orbit while working, amber while it wants you, neither when idle.
  expect(renderSlot(RUNNING)).toContain("#2DD4BF")
  expect(renderSlot({ ...RUNNING, state: "awaiting" })).toContain("#F59E0B")
  const idle = renderSlot({ ...RUNNING, state: "idle", contextPercent: 10 })
  expect(idle).not.toContain("#2DD4BF")
})

test("the orbit moves with the frame, and the still key doesn't", () => {
  expect(renderSlot(RUNNING, 0)).not.toBe(renderSlot(RUNNING, 7))
  const idle: Slot = { ...RUNNING, state: "idle" }
  expect(renderSlot(idle, 0)).toBe(renderSlot(idle, 7))
})

test("elapsed and start time share the bottom line", () => {
  expect(renderSlot(RUNNING)).toContain(">21m · 16:06<")
})

test("a session with no start time still shows what it has", () => {
  const svg = renderSlot({ ...RUNNING, startedAt: undefined })
  expect(svg).toContain(">21m<")
})

test("context over 100% is told truthfully but drawn clamped", () => {
  const svg = renderSlot({ ...RUNNING, contextPercent: 120.4 })
  expect(svg, "the number is the real one").toContain(">120%<")
  // The fill is the full track width (90 - 20), never wider.
  expect(svg).toContain('width="70"')
  expect(svg).not.toMatch(
    /width="(7[1-9]|[89][0-9]|1[0-9][0-9])(\.\d+)?"\s+height="6"/,
  )
})

test("the bar stops clear of the widest percentage it has to sit beside", () => {
  // `181%` is ~28px at 11px semibold, right-aligned to x=124 — so it occupies
  // roughly x=96 onward. A track ending past that is drawn under the number,
  // which is exactly what a two-digit-sized track did.
  const svg = renderSlot({ ...RUNNING, contextPercent: 181 })
  const track = svg.match(
    /<rect x="20" y="92" width="(\d+(?:\.\d+)?)" height="6"/,
  )
  if (!track?.[1]) {
    throw new Error("no context track drawn")
  }
  const trackEnd = 20 + Number(track[1])
  const widestLabel = 4 * 7 // 4 characters, generously wide
  expect(trackEnd).toBeLessThanOrEqual(124 - widestLabel)
})

test("context colour climbs the same ladder as the cswap dial", () => {
  expect(severity(10)).toBe("#3B82F6")
  expect(severity(50)).toBe("#F59E0B")
  expect(severity(80)).toBe("#EF4444")
})

test("an empty slot stays quiet", () => {
  // Seven keys of "no session" would shout louder than the two that have one.
  expect(renderEmpty()).not.toContain("<text")
})

test("repo names off the filesystem can't break the markup", () => {
  expect(escapeXml('a&b<c>"d"')).toBe("a&amp;b&lt;c&gt;&quot;d&quot;")
  expect(renderSlot({ ...RUNNING, repo: "a&b" })).toContain(">a&amp;b<")
})

test("truncation only marks what it actually cut", () => {
  expect(truncate("steward", 11)).toBe("steward")
  expect(truncate("a-very-long-repo-name", 11)).toBe("a-very-lon…")
})

test("the data uri is what the key takes", () => {
  const uri = svgDataUri("<svg/>")
  expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true)
  expect(Buffer.from(uri.split(",")[1] ?? "", "base64").toString("utf8")).toBe(
    "<svg/>",
  )
})
