import { defineConfig } from "tsdown"

// The plugin is a Node executable the Stream Deck app launches, not a library:
// bundle the entry (and its runtime deps) into a single self-contained file at
// the manifest's CodePath (`bin/plugin.js` inside the .sdPlugin folder).
export default defineConfig({
  entry: ["src/plugin.ts"],
  outDir: "com.dmoraes.github-stats.sdPlugin/bin",
  format: ["esm"],
  platform: "node",
  // Stream Deck runs plugins on its bundled Node 20 (see manifest Nodejs.Version),
  // so emit for node20 even though the dev toolchain requires node >= 24.
  target: "node20",
  dts: false,
  clean: true,
  // Emit `plugin.js` (not `.mjs`) to match the manifest CodePath.
  outExtensions: () => ({ js: ".js" }),
  deps: {
    // Bundle dependencies so `streamdeck pack` yields a self-contained plugin.
    alwaysBundle: [/.*/],
    // `ws` optionally pulls these native speed-ups via try/catch; keep external.
    neverBundle: ["bufferutil", "utf-8-validate"],
  },
})
