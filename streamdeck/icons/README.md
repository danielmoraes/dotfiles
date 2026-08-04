# Icons

Stream Deck takes SVG for almost every image slot, so action icons and key
backgrounds are **hand-authored SVGs** living next to each plugin, in
`plugins/<name>/<uuid>.sdPlugin/imgs/`.

The one exception is the **plugin icon** (shown in Stream Deck's preferences),
which the manifest schema requires to be PNG at 256×256 and 512×512. Those are
generated here.

```sh
pnpm -C streamdeck/icons build     # writes icon.png + icon@2x.png per plugin
```

## Why a generator

Rasterising SVG in Node needs a native dependency, and committing binaries with
no source is how icons drift from the design. Instead `src/` draws the marks
procedurally: `canvas.ts` is a small anti-aliased rasteriser built on signed
distance fields, `png.ts` is a minimal PNG encoder over `node:zlib`, and
`marks.ts` defines one mark per plugin in normalised coordinates. No
dependencies, and the same source renders both sizes exactly.

## Style

- Flat, high contrast, a solid accent plate with a white mark.
- One accent per category, matching the deck page the plugin's keys live on:
  **agents = purple**, **work/status = blue** (`#3B82F6`),
  **modes/metrics = green** (`#22C55E`), **media = teal**.
- Key backgrounds stay quiet — a small glyph up top and a coloured rule along
  the bottom — because the action writes the actual value as the key _title_
  over the middle. That middle is why every key title is centred, including the
  static ones: bottom-aligning them puts the word through the rule.
- **A resting key is black** (`#000000`), like the deck's own unlit keys and
  everything else drawn here — the session keys, the `cswap` dial strip, the
  page-turn key. A near-black card (`#16191F`) looks considered in isolation and
  reads as a grey rectangle in a row of black ones; that's what pulled the
  session keys black in `07e1f32` and the dial strip in `99aa6d8`, and the same
  applies to a key background sitting on the same deck.
- **An "attention" variant swaps the rule to red** (`#EF4444`) and warms the
  card — `#1F1416` for alert, `#1F1A14` for a countdown running out. Against a
  black resting key those read as a lit card, not just a hue shift: the whole
  key comes up, which is the point of a state you're meant to catch sideways-on.
- Elgato's specs: category icon 28×28 and action icon 20×20, both monochrome
  white on transparent; key images 72×72 (144×144 @2x).

## Adding a plugin

Add a `Mark` to `src/marks.ts` keyed by the plugin's UUID and re-run the build —
it resolves the output directory from the UUID.
