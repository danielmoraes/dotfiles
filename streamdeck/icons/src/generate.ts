import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Canvas } from "./canvas.ts"
import { MARKS } from "./marks.ts"
import { encodePng } from "./png.ts"

/**
 * Writes `imgs/plugin/icon.png` (256px) and `icon@2x.png` (512px) into each
 * custom plugin's `.sdPlugin` folder — the sizes Elgato's manifest schema
 * requires for the plugin icon shown in Stream Deck's preferences.
 *
 * Run with `pnpm -C streamdeck/icons build` (plain `node`, no build step —
 * Node 24 strips the types).
 */

const PLUGINS_DIR = join(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
  "plugins",
)

/** Maps a plugin UUID to its package folder (`com.dmoraes.x` -> `x`). */
function packageName(pluginUuid: string): string {
  return pluginUuid.replace(/^com\.dmoraes\./, "")
}

for (const mark of MARKS) {
  const outDir = join(
    PLUGINS_DIR,
    packageName(mark.plugin),
    `${mark.plugin}.sdPlugin`,
    "imgs",
    "plugin",
  )
  await mkdir(outDir, { recursive: true })

  for (const [size, name] of [
    [256, "icon.png"],
    [512, "icon@2x.png"],
  ] as const) {
    const canvas = new Canvas(size)
    mark.draw(canvas)
    await writeFile(join(outDir, name), encodePng(size, size, canvas.toRgba()))
  }
  console.log(`✓ ${mark.plugin} icon.png + icon@2x.png`)
}
