import { expect, test } from "vite-plus/test"
import { COLUMNS, DIALS, PAGES, ROWS } from "./layout.ts"
import { buildProfile, pageManifest, stableUuid } from "./profile.ts"
import { findDevice, profilesNamed } from "./install.ts"

const DEVICE = { Model: "20GBD9901", UUID: "@(1)[4057/132/TEST]" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Pull the Keypad / Encoder slot maps out of a page manifest. */
function controllers(page: unknown): {
  keypad: Record<string, unknown>
  encoder: Record<string, unknown>
} {
  if (!isRecord(page) || !Array.isArray(page.Controllers)) {
    throw new Error("not a page manifest")
  }
  // Hoisted: narrowing a property doesn't survive into the closure below.
  const list: unknown[] = page.Controllers
  const find = (type: string): Record<string, unknown> => {
    const entry = list.find((c: unknown) => isRecord(c) && c.Type === type)
    if (!isRecord(entry) || !isRecord(entry.Actions)) {
      return {}
    }
    return entry.Actions
  }
  return { keypad: find("Keypad"), encoder: find("Encoder") }
}

test("stableUuid is deterministic, well-formed and seed-sensitive", () => {
  expect(stableUuid("a")).toBe(stableUuid("a"))
  expect(stableUuid("a")).not.toBe(stableUuid("b"))
  expect(stableUuid("a")).toMatch(
    /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}$/,
  )
})

test("command keys use the commands plugin, never Elgato's Open action", () => {
  // `Open` runs `open <path>`, which hands an extension-less shell script to
  // the user's terminal app — the key spawned a window and ran nothing.
  for (const page of PAGES) {
    const { keypad } = controllers(pageManifest(page))
    for (const entry of Object.values(keypad)) {
      if (isRecord(entry)) {
        expect(entry.UUID, `${page.title}`).not.toBe(
          "com.elgato.streamdeck.system.open",
        )
      }
    }
  }
})

test("command keys carry the command name and its args", () => {
  const { keypad } = controllers(pageManifest(PAGES[0]!))
  // P1 K2 launches Claude via sd-summon-agent claude.
  const k2 = keypad["1,0"]
  if (!isRecord(k2) || !isRecord(k2.Settings)) {
    throw new Error("expected a command action at K2")
  }
  expect(k2.UUID).toBe("com.dmoraes.commands.run")
  expect(k2.Settings.command).toBe("sd-summon-agent")
  expect(k2.Settings.args).toEqual(["claude"])
})

test("the profile manifest lists every page and points at the first", () => {
  const { files, dirName } = buildProfile(DEVICE)
  expect(dirName).toMatch(/\.sdProfile$/)

  const manifest = files["manifest.json"]
  if (!isRecord(manifest) || !isRecord(manifest.Pages)) {
    throw new Error("bad manifest")
  }
  expect(manifest.Device).toEqual(DEVICE)
  expect(manifest.Version).toBe("3.0")
  expect(manifest.Name).toBe("Dotfiles")

  const pages = manifest.Pages.Pages
  expect(Array.isArray(pages) && pages.length).toBe(PAGES.length)
  expect(manifest.Pages.Current).toBe(Array.isArray(pages) ? pages[0] : null)
  // Page ids are lowercased in the manifest but uppercase as directory names.
  for (const id of Array.isArray(pages) ? pages : []) {
    expect(String(id)).toBe(String(id).toLowerCase())
    expect(
      files[`Profiles/${String(id).toUpperCase()}/manifest.json`],
    ).toBeDefined()
  }
})

test("the blank Default page exists but is not in the visible cycle", () => {
  const { files } = buildProfile(DEVICE)
  const manifest = files["manifest.json"]
  if (!isRecord(manifest) || !isRecord(manifest.Pages)) {
    throw new Error("bad manifest")
  }
  const { Default, Pages: visible } = manifest.Pages
  expect(Array.isArray(visible) && visible).not.toContain(Default)
  const blank = files[`Profiles/${String(Default).toUpperCase()}/manifest.json`]
  expect(isRecord(blank)).toBe(true)
})

test("each page fills the deck's 8 keys and 4 dials", () => {
  for (const page of PAGES) {
    const { keypad, encoder } = controllers(pageManifest(page))
    expect(Object.keys(keypad).length, `${page.title} keys`).toBe(
      COLUMNS * ROWS,
    )
    expect(Object.keys(encoder).length, `${page.title} dials`).toBe(DIALS)
  }
})

test("key slots are addressed col,row within the hardware bounds", () => {
  const { keypad, encoder } = controllers(pageManifest(PAGES[0]!))
  for (const slot of Object.keys(keypad)) {
    const [col, row] = slot.split(",").map(Number)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(COLUMNS)
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(ROWS)
  }
  // Encoders are a single row.
  expect(Object.keys(encoder).sort()).toEqual(["0,0", "1,0", "2,0", "3,0"])
})

test("K8 on every page advances to the next page, so the cycle closes", () => {
  for (const page of PAGES) {
    const { keypad } = controllers(pageManifest(page))
    const k8 = keypad[`${COLUMNS - 1},${ROWS - 1}`]
    if (!isRecord(k8)) {
      throw new Error(`${page.title} has no K8`)
    }
    expect(k8.UUID, `${page.title} K8`).toBe("com.elgato.streamdeck.page.next")
  }
})

test("dial entries carry an Encoder block and keys do not", () => {
  const { keypad, encoder } = controllers(pageManifest(PAGES[0]!))
  for (const entry of Object.values(encoder)) {
    expect(isRecord(entry) && "Encoder" in entry).toBe(true)
  }
  for (const entry of Object.values(keypad)) {
    expect(isRecord(entry) && "Encoder" in entry).toBe(false)
  }
})

test("plugin actions declare their owning plugin and keep their settings", () => {
  const { keypad } = controllers(pageManifest(PAGES[1]!))
  const k1 = keypad["0,0"]
  if (!isRecord(k1) || !isRecord(k1.Plugin) || !isRecord(k1.Settings)) {
    throw new Error("expected a configured plugin action at K1")
  }
  expect(k1.UUID).toBe("com.dmoraes.github-stats.search-count")
  expect(k1.Plugin.UUID).toBe("com.dmoraes.github-stats")
  expect(k1.Settings.query).toBe("is:open is:pr review-requested:@me")
})

test("action UUIDs are all prefixed by their plugin UUID", () => {
  for (const page of PAGES) {
    const { keypad, encoder } = controllers(pageManifest(page))
    for (const entry of [...Object.values(keypad), ...Object.values(encoder)]) {
      if (!isRecord(entry) || !isRecord(entry.Plugin)) {
        continue
      }
      expect(String(entry.UUID)).toMatch(
        new RegExp(`^${String(entry.Plugin.UUID).replaceAll(".", "\\.")}\\.`),
      )
    }
  }
})

test("every action id is unique across the whole profile", () => {
  const ids: string[] = []
  for (const page of PAGES) {
    const { keypad, encoder } = controllers(pageManifest(page))
    for (const entry of [...Object.values(keypad), ...Object.values(encoder)]) {
      if (isRecord(entry) && typeof entry.ActionID === "string") {
        ids.push(entry.ActionID)
      }
    }
  }
  expect(new Set(ids).size).toBe(ids.length)
})

test("findDevice picks the Stream Deck + and ignores other models", () => {
  const manifests = [
    { Device: { Model: "AI Stream Deck", UUID: "virtual" }, Name: "Default" },
    { Device: DEVICE, Name: "Muxboard" },
  ]
  expect(findDevice(manifests)).toEqual(DEVICE)
  expect(findDevice([{ Device: { Model: "other", UUID: "x" } }])).toBeNull()
  expect(findDevice([null, "nope", {}])).toBeNull()
})

test("profilesNamed finds previous copies to replace", () => {
  const manifests = [
    { dir: "A.sdProfile", manifest: { Name: "Dotfiles" } },
    { dir: "B.sdProfile", manifest: { Name: "Muxboard" } },
    { dir: "C.sdProfile", manifest: { Name: "Dotfiles" } },
  ]
  expect(profilesNamed(manifests, "Dotfiles")).toEqual([
    "A.sdProfile",
    "C.sdProfile",
  ])
  expect(profilesNamed(manifests, "Nope")).toEqual([])
})
