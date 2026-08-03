import { expect, test } from "vite-plus/test"
import { type Page, COLUMNS, DIALS, PAGES, ROWS } from "./layout.ts"
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

test("command keys carry the command name", () => {
  // P3 K1 runs sd-focus-mode. Page 1 is all session slots — it has no scripts.
  const { keypad } = controllers(pageManifest(PAGES[2]!))
  const k1 = keypad["0,0"]
  if (!isRecord(k1) || !isRecord(k1.Settings)) {
    throw new Error("expected a command action at K1")
  }
  expect(k1.UUID).toBe("com.dmoraes.commands.run")
  expect(k1.Settings.command).toBe("sd-focus-mode")
  expect(k1.Settings.args).toEqual([])
})

test("command args survive serialisation", () => {
  // No key on the deck passes args today, so cover the path directly rather
  // than let it rot: the plugin reads `args` straight out of these settings.
  const page: Page = {
    title: "Args",
    keys: [
      { kind: "run", command: "sd-summon-agent", args: ["claude"], title: "C" },
    ],
    dials: [],
  }
  const { keypad } = controllers(pageManifest(page))
  const k1 = keypad["0,0"]
  if (!isRecord(k1) || !isRecord(k1.Settings)) {
    throw new Error("expected a command action at K1")
  }
  expect(k1.Settings.command).toBe("sd-summon-agent")
  expect(k1.Settings.args).toEqual(["claude"])
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

test("every page fills all 8 keys; dials are the same subset everywhere", () => {
  // Only 2 of 4 dials are filled today (cswap accounts, system volume).
  // Everything tried in the gaps was pulled rather than left holding a dead,
  // broken or duplicate control — see DIAL_STRIP's comment. Keys have no such
  // out: all 8 are always bound.
  for (const page of PAGES) {
    const { keypad, encoder } = controllers(pageManifest(page))
    expect(Object.keys(keypad).length, `${page.title} keys`).toBe(
      COLUMNS * ROWS,
    )
    expect(Object.keys(encoder).sort(), `${page.title} dials`).toEqual([
      "0,0",
      "3,0",
    ])
  }
})

test("key and dial slots are addressed col,row within the hardware bounds", () => {
  const { keypad, encoder } = controllers(pageManifest(PAGES[0]!))
  for (const slot of Object.keys(keypad)) {
    const [col, row] = slot.split(",").map(Number)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(COLUMNS)
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(ROWS)
  }
  // Encoders are a single row, addressed within the dial count.
  for (const slot of Object.keys(encoder)) {
    const [col, row] = slot.split(",").map(Number)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(DIALS)
    expect(row).toBe(0)
  }
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

test("multimedia dials are Elgato's built-in system action, unscoped to a plugin", () => {
  // Like nextPage, this is a system action: no Plugin block, so the
  // "prefixed by its plugin UUID" check below skips it rather than failing it.
  const { encoder } = controllers(pageManifest(PAGES[0]!))
  const d4 = encoder["3,0"]
  if (!isRecord(d4) || !isRecord(d4.Settings)) {
    throw new Error("expected a multimedia action at D4")
  }
  expect(d4.UUID).toBe("com.elgato.streamdeck.system.multimedia")
  expect(d4.Plugin).toBeUndefined()
  expect(d4.Settings.actionIdx).toBe(18)
})

test("D1 is the cswap accounts dial, and it's the only quota readout", () => {
  // Two other plugins held a dial showing the *signed-in* account's quota
  // (AgentDeck's gauge, then AI Usage Limits). Both were dropped as duplicates
  // of each other and of this, which covers every account and switches between
  // them. A second quota dial reappearing is the regression worth catching.
  const { encoder } = controllers(pageManifest(PAGES[0]!))
  const d1 = encoder["0,0"]
  if (!isRecord(d1) || !isRecord(d1.Plugin)) {
    throw new Error("expected a plugin action at D1")
  }
  expect(d1.UUID).toBe("com.dmoraes.cswap.accounts")
  expect(d1.Plugin.UUID).toBe("com.dmoraes.cswap")
  expect(d1.Encoder).toBeDefined()

  for (const entry of Object.values(encoder)) {
    if (isRecord(entry) && isRecord(entry.Plugin)) {
      expect(entry.Plugin.UUID, "a second plugin dial is back").toBe(
        "com.dmoraes.cswap",
      )
    }
  }
})

test("no dial depends on the AgentDeck daemon", () => {
  // Its session keys on page 1 still do, deliberately — but the dial strip is
  // meant to keep working when the daemon is down, which is what cost
  // AgentDeck's own volume dial its slot earlier.
  for (const page of PAGES) {
    const { encoder } = controllers(pageManifest(page))
    for (const entry of Object.values(encoder)) {
      if (isRecord(entry)) {
        expect(String(entry.UUID), `${page.title}`).not.toMatch(/agentdeck/)
      }
    }
  }
})

test("the dial strip is identical on every page", () => {
  // Dials are steady-state controls reached for without looking, so unlike
  // keys — which are meant to change per page — the same four should mean
  // the same thing everywhere. ActionID is seeded per-page (see "every action
  // id is unique across the whole profile" above), so it's excluded here —
  // everything else about each slot should match exactly.
  const withoutActionId = (entry: unknown) =>
    isRecord(entry) ? { ...entry, ActionID: undefined } : entry
  const strip = (encoder: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(encoder).map(([slot, entry]) => [
        slot,
        withoutActionId(entry),
      ]),
    )

  const [first, ...rest] = PAGES.map((page) =>
    strip(controllers(pageManifest(page)).encoder),
  )
  for (const [index, encoder] of rest.entries()) {
    expect(encoder, PAGES[index + 1]?.title).toEqual(first)
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
