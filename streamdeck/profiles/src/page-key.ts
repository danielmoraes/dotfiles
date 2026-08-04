/**
 * What the page-turn key shows.
 *
 * Pure — a label and a position in, SVG out — so it's tested by asserting on
 * markup rather than by looking at hardware.
 *
 * **This exists to stop Elgato drawing K8.** The built-in `page.next` action
 * ships its own artwork: a solid white rounded square with a chevron punched
 * out of it, 54px in the middle of the key. On a deck whose every other key is
 * black with quiet text, that badge is the brightest object on the page — a
 * navigation affordance out-shouting seven status readouts. It also arrives
 * with the app's own title layer, which centres the label on a baseline nothing
 * else uses, so the one word on K8 sat below and between the rows its
 * neighbours are set on.
 *
 * So the key is drawn here instead and handed to the action as its state image
 * (see `profile.ts`), with the app's title layer switched off. The action still
 * does the page turning; only the face changes.
 *
 * The geometry deliberately matches `../../plugins/sessions/src/render.ts` —
 * same canvas, same panel, same gutters, same baselines, same palette — because
 * on page 1 this key sits directly beside seven of those. The constants are
 * repeated rather than shared: the two live in separate packages (a generator
 * and a plugin) with no common dependency, and inventing one to carry six
 * colours would cost more than it saves. They're a design language, not an API.
 */

/** Keys are 72x72 points; the @2x canvas every deck actually renders is 144. */
const SIZE = 144
/** The inner panel, on the same path the session keys draw their state border. */
const PANEL = { x: 8, y: 8, w: 128, h: 128, r: 12 }

const LEFT = 20
/** Right text edge, mirroring the left gutter. */
const RIGHT = SIZE - LEFT

/**
 * The rows, as baselines — the same ones the session keys use.
 *
 * `label` is their heading row and `dots` their footer row, so a glance across
 * the bottom of page 1 finds every key's last line at one height, and a glance
 * across the top finds every key's first line at another. That alignment is the
 * whole reason the numbers are these numbers.
 */
const ROW = { label: 44, dots: 118 }

const BG = "#000000"
const WHITE = "#FFFFFF"
/** Secondary — the current page's dot. */
const SUB = "#C6D0DC"
/** Tertiary, for the chevron: present, but not competing with the label. */
const FAINT = "#93A1B2"
/** The panel edge, and the dots for pages you aren't on. */
const TRACK = "#2A2F3A"

/** Page names are ours and short, but SVG is XML and this costs nothing. */
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * The chevron, drawn rather than typed.
 *
 * The obvious characters for this are `▶` (which the label used to carry) and
 * `›`, and both are wrong. `▶` is a *play* triangle — it says "start" in every
 * other place on this desk, and it was saying "next page" here only because it
 * happened to point the right way. And any character at all is a gamble: the
 * deck renders SVG with whatever fonts it has, so an unusual glyph that falls
 * back to tofu would be worse than no marker. Three line segments always render.
 *
 * `y` is the *optical* centre of the label's cap height rather than its
 * baseline, which is what puts the mark on the same line as the word instead of
 * hanging below it.
 */
function chevron(x: number, y: number, size: number): string {
  const arm = size * 0.35
  return (
    `<path d="M${x - arm} ${y - size} L${x + arm} ${y} L${x - arm} ${y + size}" ` +
    `fill="none" stroke="${FAINT}" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>`
  )
}

/**
 * Where you are in the page cycle, as dots.
 *
 * The label answers "where does this go"; the dots answer "where am I", which
 * is the other half of the question and free to show. They also give the key a
 * bottom row, so it carries the same vertical rhythm as the keys beside it
 * rather than being one line adrift at the top of an empty card.
 *
 * The filled dot is the page the key *lives on*, not the one it leads to.
 */
function dots(index: number, total: number): string {
  return Array.from({ length: total }, (_, i) => {
    const current = i === index
    return (
      `<circle cx="${LEFT + 2 + i * 12}" cy="${ROW.dots}" ` +
      `r="${current ? 3 : 2.5}" fill="${current ? SUB : TRACK}"/>`
    )
  }).join("")
}

export type PageKey = {
  /** The page this key leads to, e.g. `Work`. */
  label: string
  /** Zero-based index of the page this key is *on*. */
  index: number
  /** How many pages the cycle has. */
  total: number
}

/**
 * The page-turn key.
 *
 * The label is the destination and nothing else — no "next", no page number,
 * no second arrow. One word and one mark for one idea.
 */
export function renderPageKey({ label, index, total }: PageKey): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `<rect width="${SIZE}" height="${SIZE}" rx="16" fill="${BG}"/>`,
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="${PANEL.r}" ` +
      `fill="none" stroke="${TRACK}" stroke-width="1.5"/>`,
    `<text x="${LEFT}" y="${ROW.label}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ` +
      `font-size="17" font-weight="700" fill="${WHITE}">${escapeXml(label)}</text>`,
    // Six characters of the widest alphabet at 17px bold is ~62px, so a name
    // set at the left gutter clears the chevron's own gutter with room to
    // spare. Page names are written in `layout.ts` and are one word each.
    chevron(RIGHT - 6, ROW.label - 6, 7),
    dots(index, total),
    "</svg>",
  ].join("")
}
