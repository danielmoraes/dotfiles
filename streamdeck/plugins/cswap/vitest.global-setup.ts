import { spawn } from "node:child_process"

// Vitest global setup: build the plugin bundle so the e2e test can spawn the
// real plugin process (mirrors what the Stream Deck app launches).
export default async function setup(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("pnpm", ["exec", "tsdown"], { stdio: "inherit" })
    proc.on("error", reject)
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`tsdown build failed with exit code ${code}`))
      }
    })
  })
}
