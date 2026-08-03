#!/usr/bin/env node
import { realCtx } from "../lib/ctx"
import { run } from "../commands/summon-agent"

run(realCtx(), process.argv.slice(2)).catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
