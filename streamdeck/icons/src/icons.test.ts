import { expect, test } from "vite-plus/test"
import {
  Canvas,
  circle,
  rgb,
  roundedRect,
  segment,
  subtract,
  union,
} from "./canvas.ts"
import { MARKS } from "./marks.ts"
import { encodePng } from "./png.ts"

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Read the RGBA quad at (x, y) out of a canvas. */
function pixel(canvas: Canvas, x: number, y: number): number[] {
  const rgba = canvas.toRgba()
  const i = (y * canvas.size + x) * 4
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]].map((v) => v ?? 0)
}

test("encodePng emits a signature, IHDR and IEND", () => {
  const png = encodePng(2, 2, new Uint8Array(2 * 2 * 4).fill(255))
  expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR")
  // IHDR payload: width, height, then bit depth 8 / colour type 6 (RGBA).
  expect(png.readUInt32BE(16)).toBe(2)
  expect(png.readUInt32BE(20)).toBe(2)
  expect(png[24]).toBe(8)
  expect(png[25]).toBe(6)
  expect(png.subarray(png.length - 8, png.length - 4).toString("ascii")).toBe(
    "IEND",
  )
})

test("encodePng round-trips through an independent decoder", async () => {
  // Check the bytes with something that isn't our own reader. `file(1)` is on
  // both macOS and the Linux CI image, and reports geometry *and* colour type —
  // so it catches a wrong IHDR that our own parser would happily agree with.
  const { execFileSync } = await import("node:child_process")
  const { mkdtempSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")

  const canvas = new Canvas(32)
  canvas.fill(circle(0.5, 0.5, 0.4), rgb("#3B82F6"))
  const dir = mkdtempSync(join(tmpdir(), "sd-icons-"))
  const out = join(dir, "out.png")
  writeFileSync(out, encodePng(32, 32, canvas.toRgba()))

  const info = execFileSync("file", [out], { encoding: "utf8" })
  expect(info).toContain("PNG image data")
  expect(info).toContain("32 x 32")
  expect(info).toContain("8-bit/color RGBA")
  expect(info).toContain("non-interlaced")
})

test("a filled shape is opaque inside and transparent outside", () => {
  const canvas = new Canvas(64)
  canvas.fill(circle(0.5, 0.5, 0.3), rgb("#FF0000"))
  expect(pixel(canvas, 32, 32)).toEqual([255, 0, 0, 255])
  expect(pixel(canvas, 1, 1)[3]).toBe(0)
})

test("edges are anti-aliased rather than hard-clipped", () => {
  const canvas = new Canvas(64)
  canvas.fill(circle(0.5, 0.5, 0.25), rgb("#FFFFFF"))
  // Walk out along the centre row and find a partially covered pixel.
  const alphas = Array.from(
    { length: 32 },
    (_, x) => pixel(canvas, 32 + x, 32)[3] ?? 0,
  )
  expect(alphas.some((a) => a > 0 && a < 255)).toBe(true)
})

test("source-over compositing lets a later fill cover an earlier one", () => {
  const canvas = new Canvas(16)
  canvas.fill(roundedRect(0.5, 0.5, 0.5, 0.5, 0), rgb("#0000FF"))
  canvas.fill(circle(0.5, 0.5, 0.3), rgb("#00FF00"))
  expect(pixel(canvas, 8, 8)).toEqual([0, 255, 0, 255])
  expect(pixel(canvas, 0, 0)).toEqual([0, 0, 255, 255])
})

test("union takes the nearer edge and subtract punches a hole", () => {
  const left = circle(0.3, 0.5, 0.2)
  const right = circle(0.7, 0.5, 0.2)
  expect(union(left, right)(0.3, 0.5)).toBeLessThan(0)
  expect(union(left, right)(0.7, 0.5)).toBeLessThan(0)
  expect(union(left, right)(0.5, 0.1)).toBeGreaterThan(0)

  const holed = subtract(circle(0.5, 0.5, 0.4), circle(0.5, 0.5, 0.2))
  expect(holed(0.5, 0.5)).toBeGreaterThan(0)
  expect(holed(0.5, 0.2)).toBeLessThan(0)
})

test("segment is a capsule around the line", () => {
  const line = segment(0.2, 0.5, 0.8, 0.5, 0.1)
  expect(line(0.5, 0.5)).toBeCloseTo(-0.05)
  expect(line(0.5, 0.56)).toBeGreaterThan(0)
  // Round caps extend half the width past each endpoint.
  expect(line(0.83, 0.5)).toBeLessThan(0)
  expect(line(0.9, 0.5)).toBeGreaterThan(0)
})

test("rgb parses hex into 0..1 channels", () => {
  expect(rgb("#FFFFFF")).toEqual([1, 1, 1])
  expect(rgb("#000000")).toEqual([0, 0, 0])
  const [r, g, b] = rgb("#3B82F6")
  expect(r).toBeCloseTo(0x3b / 255)
  expect(g).toBeCloseTo(0x82 / 255)
  expect(b).toBeCloseTo(0xf6 / 255)
})

test("every mark draws something and fills the plate corner-to-corner", () => {
  for (const mark of MARKS) {
    const canvas = new Canvas(64)
    mark.draw(canvas)
    const rgba = canvas.toRgba()
    // The plate covers the centre...
    expect(pixel(canvas, 32, 32)[3]).toBe(255)
    // ...and the rounded corner stays transparent.
    expect(pixel(canvas, 0, 0)[3]).toBe(0)
    // ...and the white mark is actually present somewhere.
    const hasWhite = Array.from({ length: 64 * 64 }, (_, i) => i).some((i) => {
      const o = i * 4
      return (
        (rgba[o] ?? 0) > 230 &&
        (rgba[o + 1] ?? 0) > 230 &&
        (rgba[o + 2] ?? 0) > 230
      )
    })
    expect(hasWhite, `${mark.plugin} should draw a white mark`).toBe(true)
  }
})

test("marks cover one plugin each, with no duplicate targets", () => {
  const targets = MARKS.map((m) => m.plugin)
  expect(new Set(targets).size).toBe(targets.length)
  expect(targets).toContain("com.dmoraes.github-stats")
  expect(targets).toContain("com.dmoraes.slack-unread")
  expect(targets).toContain("com.dmoraes.weekly-metrics")
})
