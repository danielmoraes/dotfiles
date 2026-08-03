import {
  type Binding,
  type Page,
  COLUMNS,
  DIALS,
  PAGES,
  PROFILE_NAME,
  ROWS,
} from "./layout.ts"

/**
 * Serialise the layout into the Stream Deck app's on-disk profile format
 * (`ProfilesV3`), which is plain JSON:
 *
 *   <PROFILE-UUID>.sdProfile/
 *     manifest.json                     device + page list
 *     Profiles/<PAGE-UUID>/manifest.json   one per page: its keys and dials
 *
 * Page manifests hold a `Controllers` array — one entry for the Keypad, one for
 * the Encoder row — each mapping a `"col,row"` slot to an action.
 */

export type Device = {
  Model: string
  UUID: string
}

/** A `"col,row"` -> action map, as the page manifest stores it. */
type Slots = Record<string, unknown>

export type ProfileFiles = {
  /** Directory name for the profile bundle, e.g. `AB7A….sdProfile`. */
  dirName: string
  /** Relative file path -> JSON contents. */
  files: Record<string, unknown>
}

/**
 * Deterministic UUIDs.
 *
 * The app only needs these to be unique and stable; deriving them from the
 * profile/page name (rather than randomly) means re-running the generator
 * rewrites the same profile instead of piling up duplicates, and keeps the
 * output diffable.
 */
export function stableUuid(seed: string): string {
  // FNV-1a over the seed, expanded to 128 bits by re-hashing with a counter.
  const chunks: string[] = []
  for (let i = 0; i < 4; i++) {
    let hash = 0x811c9dc5
    for (const ch of `${seed}#${i}`) {
      hash ^= ch.codePointAt(0) ?? 0
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    chunks.push(hash.toString(16).padStart(8, "0"))
  }
  const hex = chunks.join("")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Version 4 / variant bits, so the app sees a well-formed UUID.
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ]
    .join("-")
    .toUpperCase()
}

/** Key titles render small at the bottom; plugin actions draw their own. */
function keyState(title?: string): Record<string, unknown> {
  if (title === undefined) {
    return { ShowTitle: true, TitleAlignment: "middle", TitleColor: "#ffffff" }
  }
  return {
    FontFamily: "",
    FontSize: 11,
    FontStyle: "",
    FontUnderline: false,
    OutlineThickness: 2,
    ShowTitle: true,
    Title: title,
    TitleAlignment: "bottom",
    TitleColor: "#ffffff",
  }
}

/**
 * Quote a command line for Elgato's "Open" action, whose `path` setting is a
 * shell-parsed string — hence the embedded quotes around the executable.
 */
export function openPath(
  command: string,
  args: readonly string[] = [],
): string {
  return [`"${command}"`, ...args].join(" ")
}

function action(
  binding: Binding,
  seed: string,
  controller: "Keypad" | "Encoder",
): Record<string, unknown> {
  const base = {
    ActionID: stableUuid(`action:${seed}`).toLowerCase(),
    LinkedTitle: false,
    Resources: null,
    State: 0,
    // Encoder entries carry an `Encoder` block; the app fills in its defaults.
    ...(controller === "Encoder" ? { Encoder: {} } : {}),
  }

  switch (binding.kind) {
    case "run":
      return {
        ...base,
        Name: "Open",
        Settings: { path: openPath(binding.command, binding.args) },
        States: [keyState(binding.title)],
        UUID: "com.elgato.streamdeck.system.open",
      }
    case "website":
      return {
        ...base,
        Name: "Website",
        Settings: { openInBrowser: true, path: binding.url },
        States: [keyState(binding.title)],
        UUID: "com.elgato.streamdeck.system.website",
      }
    case "nextPage":
      return {
        ...base,
        Name: "Next Page",
        Settings: {},
        States: [keyState(binding.title)],
        UUID: "com.elgato.streamdeck.page.next",
      }
    case "plugin":
      return {
        ...base,
        Name: binding.name,
        Plugin: {
          Name: binding.plugin.name,
          UUID: binding.plugin.uuid,
          Version: binding.plugin.version,
        },
        Settings: binding.settings ?? {},
        States: [keyState(binding.title)],
        UUID: binding.action,
      }
  }
}

/** Build the `"col,row"` maps for one page. */
export function pageManifest(page: Page): Record<string, unknown> {
  const keypad: Slots = {}
  page.keys.slice(0, COLUMNS * ROWS).forEach((binding, index) => {
    if (!binding) {
      return
    }
    const col = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    keypad[`${col},${row}`] = action(
      binding,
      `${page.title}:key:${col},${row}`,
      "Keypad",
    )
  })

  const encoder: Slots = {}
  page.dials.slice(0, DIALS).forEach((binding, index) => {
    if (!binding) {
      return
    }
    encoder[`${index},0`] = action(
      binding,
      `${page.title}:dial:${index}`,
      "Encoder",
    )
  })

  return {
    Controllers: [
      {
        Actions: Object.keys(keypad).length > 0 ? keypad : null,
        Type: "Keypad",
      },
      {
        Actions: Object.keys(encoder).length > 0 ? encoder : null,
        Type: "Encoder",
      },
    ],
    Icon: "",
    Name: page.title,
  }
}

/** Build every file for the profile bundle. */
export function buildProfile(
  device: Device,
  pages: readonly Page[] = PAGES,
  name = PROFILE_NAME,
): ProfileFiles {
  const profileUuid = stableUuid(`profile:${name}`)
  const pageUuids = pages.map((page) =>
    stableUuid(`page:${name}:${page.title}`),
  )
  // The app keeps a blank "Default" page as the template for new pages; it is
  // intentionally not part of the visible Pages list.
  const defaultUuid = stableUuid(`page:${name}:__default__`)

  const files: Record<string, unknown> = {
    "manifest.json": {
      Device: device,
      Name: name,
      Pages: {
        Current: pageUuids[0]?.toLowerCase(),
        Default: defaultUuid.toLowerCase(),
        Pages: pageUuids.map((uuid) => uuid.toLowerCase()),
      },
      Version: "3.0",
    },
    [`Profiles/${defaultUuid}/manifest.json`]: {
      Controllers: [
        { Actions: null, Type: "Keypad" },
        { Actions: null, Type: "Encoder" },
      ],
      Icon: "",
      Name: "",
    },
  }

  pages.forEach((page, index) => {
    const uuid = pageUuids[index]
    if (uuid) {
      files[`Profiles/${uuid}/manifest.json`] = pageManifest(page)
    }
  })

  return { dirName: `${profileUuid}.sdProfile`, files }
}
