/**
 * A tiny anti-aliased 2D rasteriser built on signed distance fields.
 *
 * Shapes are described as functions returning the signed distance from a point
 * to the shape's edge (negative inside). Coverage falls out of the distance,
 * which gives clean anti-aliasing for free and means every mark is defined in
 * resolution-independent normalised coordinates — the same source draws the
 * 256px and 512px (@2x) icons with no hinting or scaling artefacts.
 */

/** Signed distance to a shape's edge, in normalised units. Negative = inside. */
export type Sdf = (x: number, y: number) => number

export type Rgb = readonly [number, number, number]

export class Canvas {
  readonly size: number
  /** Premultiplied-alpha RGBA float buffer, 4 channels per pixel. */
  private readonly buf: Float64Array

  constructor(size: number) {
    this.size = size
    this.buf = new Float64Array(size * size * 4)
  }

  /**
   * Composite `color` wherever `sdf` reports coverage, source-over.
   *
   * Coverage is taken across one device pixel (`0.5 - d` clamped), so edges
   * soften over exactly one pixel regardless of the output size.
   */
  fill(sdf: Sdf, color: Rgb, alpha = 1): void {
    const { size, buf } = this
    const px = 1 / size
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Sample at the pixel centre, in normalised 0..1 space.
        const d = sdf((x + 0.5) * px, (y + 0.5) * px)
        const coverage = Math.min(Math.max(0.5 - d / px, 0), 1)
        if (coverage <= 0) continue
        const a = coverage * alpha
        const i = (y * size + x) * 4
        buf[i] = color[0] * a + buf[i]! * (1 - a)
        buf[i + 1] = color[1] * a + buf[i + 1]! * (1 - a)
        buf[i + 2] = color[2] * a + buf[i + 2]! * (1 - a)
        buf[i + 3] = a + buf[i + 3]! * (1 - a)
      }
    }
  }

  /** Un-premultiply and quantise to the 8-bit RGBA layout `encodePng` wants. */
  toRgba(): Uint8Array {
    const out = new Uint8Array(this.buf.length)
    for (let i = 0; i < this.buf.length; i += 4) {
      const a = this.buf[i + 3]!
      const s = a > 0 ? 1 / a : 0
      out[i] = Math.round(Math.min(this.buf[i]! * s, 1) * 255)
      out[i + 1] = Math.round(Math.min(this.buf[i + 1]! * s, 1) * 255)
      out[i + 2] = Math.round(Math.min(this.buf[i + 2]! * s, 1) * 255)
      out[i + 3] = Math.round(a * 255)
    }
    return out
  }
}

export function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function roundedRect(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  r: number,
): Sdf {
  return (x, y) => {
    const dx = Math.abs(x - cx) - (halfW - r)
    const dy = Math.abs(y - cy) - (halfH - r)
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
    return outside + Math.min(Math.max(dx, dy), 0) - r
  }
}

export function circle(cx: number, cy: number, r: number): Sdf {
  return (x, y) => Math.hypot(x - cx, y - cy) - r
}

/** A circle outline of the given stroke width. */
export function ring(cx: number, cy: number, r: number, width: number): Sdf {
  const c = circle(cx, cy, r)
  return (x, y) => Math.abs(c(x, y)) - width / 2
}

/** A line segment with round caps (a capsule). */
export function segment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
): Sdf {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  return (x, y) => {
    // Project the point onto the segment, clamped to its extent.
    const t =
      lenSq === 0
        ? 0
        : Math.min(Math.max(((x - x0) * dx + (y - y0) * dy) / lenSq, 0), 1)
    return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) - width / 2
  }
}

/** Union of shapes — the nearer edge wins. */
export function union(...shapes: Sdf[]): Sdf {
  return (x, y) => Math.min(...shapes.map((s) => s(x, y)))
}

/** `shape` with `cut` removed. */
export function subtract(shape: Sdf, cut: Sdf): Sdf {
  return (x, y) => Math.max(shape(x, y), -cut(x, y))
}
