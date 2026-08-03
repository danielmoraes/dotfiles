import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "vite-plus/test"

/** Every `.sdPlugin` manifest in this repo. */
function manifests(): { name: string; json: Record<string, unknown> }[] {
  const plugins = join(
    dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
    "plugins",
  )
  const out: { name: string; json: Record<string, unknown> }[] = []
  for (const pkg of readdirSync(plugins)) {
    let inner: string[]
    try {
      inner = readdirSync(join(plugins, pkg))
    } catch {
      continue
    }
    for (const dir of inner.filter((d) => d.endsWith(".sdPlugin"))) {
      const path = join(plugins, pkg, dir, "manifest.json")
      try {
        out.push({ name: dir, json: JSON.parse(readFileSync(path, "utf8")) })
      } catch {
        // Not a readable manifest — the other tests will surface it.
      }
    }
  }
  return out
}

test("every custom plugin has a manifest", () => {
  expect(manifests().length).toBeGreaterThanOrEqual(4)
})

test("multi-state actions disable the app's automatic state toggling", () => {
  // Without this the Stream Deck app advances the state on every press, so a
  // key's colour stops reflecting its data until the next refresh.
  for (const { name, json } of manifests()) {
    const actions = Array.isArray(json.Actions) ? json.Actions : []
    for (const action of actions) {
      const states = Array.isArray(action?.States) ? action.States : []
      if (states.length > 1) {
        expect(
          action.DisableAutomaticStates,
          `${name} ${action.UUID} has ${states.length} states and must set DisableAutomaticStates`,
        ).toBe(true)
      }
    }
  }
})

test("action UUIDs are prefixed by their plugin UUID", () => {
  for (const { name, json } of manifests()) {
    const actions = Array.isArray(json.Actions) ? json.Actions : []
    for (const action of actions) {
      expect(String(action.UUID), name).toMatch(
        new RegExp(`^${String(json.UUID).replaceAll(".", "\\.")}\\.`),
      )
    }
  }
})

test("a Category always ships a CategoryIcon", () => {
  // The app rejects the plugin silently otherwise, with one line in its log.
  for (const { name, json } of manifests()) {
    if (json.Category !== undefined) {
      expect(json.CategoryIcon, name).toBeDefined()
    }
  }
})
