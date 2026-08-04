import { expect, test } from "vite-plus/test"
import { escapeXml, renderPageKey } from "./page-key.ts"

const KEY = { label: "Work", index: 0, total: 3 }

test("the face is a whole 144px key, black like the ones beside it", () => {
  const svg = renderPageKey(KEY)
  expect(svg).toContain('width="144" height="144"')
  expect(svg).toContain('fill="#000000"')
})

test("the label is the destination page, and carries no arrow of its own", () => {
  // The arrow is drawn (see below), so a second one in the text would be the
  // same idea said twice — which is what the built-in key did.
  const svg = renderPageKey(KEY)
  expect(svg).toContain(">Work</text>")
  expect(svg).not.toMatch(/[▶>›→]<\/text>/)
})

test("the label sits on the session keys' heading baseline, in their gutter", () => {
  // The whole point of drawing this key: on page 1 it sits beside seven session
  // slots, whose first line is 17px bold at x=20, y=44. Anything else here and
  // the row doesn't read across. Keep in step with
  // `../../plugins/sessions/src/render.ts`.
  const svg = renderPageKey(KEY)
  expect(svg).toContain('x="20" y="44"')
  expect(svg).toContain('font-size="17" font-weight="700"')
})

test("the arrow is drawn, not typed", () => {
  // The deck renders SVG with whatever fonts it has, so a glyph that falls back
  // to tofu would be worse than no marker — the same reason the session key
  // draws its branch mark. Three segments always render.
  const svg = renderPageKey(KEY)
  expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+"/)
  expect(svg).toContain('fill="none"')
})

test("the dots mark the page the key is on, not the one it leads to", () => {
  const on = (index: number) =>
    [
      ...renderPageKey({ ...KEY, index }).matchAll(
        /<circle[^>]*fill="([^"]+)"/g,
      ),
    ].map((m) => m[1])

  expect(on(0)).toEqual(["#C6D0DC", "#2A2F3A", "#2A2F3A"])
  expect(on(1)).toEqual(["#2A2F3A", "#C6D0DC", "#2A2F3A"])
  expect(on(2)).toEqual(["#2A2F3A", "#2A2F3A", "#C6D0DC"])
})

test("the dots follow the page count rather than assuming three", () => {
  const count = (total: number) =>
    [...renderPageKey({ ...KEY, total }).matchAll(/<circle/g)].length
  expect(count(2)).toBe(2)
  expect(count(5)).toBe(5)
})

test("labels are escaped, because SVG is XML", () => {
  expect(escapeXml('a&b<c>"d"')).toBe("a&amp;b&lt;c&gt;&quot;d&quot;")
  expect(renderPageKey({ ...KEY, label: "R&D" })).toContain(">R&amp;D</text>")
})
