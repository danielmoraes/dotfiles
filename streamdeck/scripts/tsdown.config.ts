import { defineConfig } from "tsdown"

// Each command bundles to an executable bin/<name>.js. The entry files start
// with a `#!/usr/bin/env node` hashbang, which rolldown preserves, so the
// output is directly runnable (install.sh chmod +x and links them).
export default defineConfig({
  entry: ["src/bin/*.ts"],
  outDir: "bin",
  format: ["esm"],
  platform: "node",
  target: "node20",
  dts: false,
  clean: true,
  outExtensions: () => ({ js: ".js" }),
})
