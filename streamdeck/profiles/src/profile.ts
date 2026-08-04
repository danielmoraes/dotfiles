import {
  type Binding,
  type Page,
  COLUMNS,
  COMMANDS,
  DIALS,
  PAGES,
  PROFILE_NAME,
  ROWS,
} from "./layout.ts"
import { renderPageKey } from "./page-key.ts"

/**
 * Serialise the layout into the Stream Deck app's on-disk profile format
 * (`ProfilesV3`), which is plain JSON:
 *
 *   <PROFILE-UUID>.sdProfile/
 *     manifest.json                        device + page list
 *     Profiles/<PAGE-UUID>/manifest.json   one per page: its keys and dials
 *     Profiles/<PAGE-UUID>/Images/…        key faces this generator draws
 *
 * Page manifests hold a `Controllers` array — one entry for the Keypad, one for
 * the Encoder row — each mapping a `"col,row"` slot to an action.
 */

/**
 * The page-turn key's face, relative to its page directory.
 *
 * A key state may name an image, and the app resolves it against the page's own
 * folder — which is how it stores a picture you drag onto a key, and the only
 * way to put our own artwork on one of Elgato's built-in actions. See
 * `page-key.ts` for why K8 needs it.
 */
const NEXT_PAGE_IMAGE = "Images/next-page.svg"

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
  /** Relative file path -> verbatim text, for the key faces we draw. */
  assets: Record<string, string>
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

/**
 * A key whose label the app draws over the action's backdrop.
 *
 * Centred, always — including for keys carrying a static `title`, which used to
 * hang off the bottom edge. Every key backdrop in this repo is built for a
 * centred label: a small glyph up top, a coloured category rule along the
 * bottom, and the middle left clear for the value the action writes (see
 * `../../icons/README.md`). Bottom-aligning the static ones put "Focus",
 * "Meeting", "Capture" and "Standup" straight through that rule, and left
 * page 3 reading at two label heights — those four against the middle-aligned
 * weekly-metrics key beside them.
 */
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
    TitleAlignment: "middle",
    TitleColor: "#ffffff",
  }
}

/**
 * A key whose whole face is an image we drew.
 *
 * The label is part of that image, so the app's title layer is switched off
 * rather than left to stack a second copy on a baseline of its own choosing.
 * `Title` is still carried: it's what the Stream Deck app's editor lists the
 * key as, and losing it would make the profile unreadable in the UI.
 */
function drawnState(title: string, image: string): Record<string, unknown> {
  return {
    FontFamily: "",
    FontSize: 11,
    FontStyle: "",
    FontUnderline: false,
    Image: image,
    OutlineThickness: 2,
    ShowTitle: false,
    Title: title,
    TitleAlignment: "middle",
    TitleColor: "#ffffff",
  }
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
      // Deliberately not Elgato's "Open" action: that runs `open <path>`, which
      // hands an extension-less shell script to the user's terminal app instead
      // of executing it — pressing the key spawned a terminal window and ran
      // nothing. The `commands` plugin executes it directly.
      return {
        ...base,
        Name: "Run Command",
        Plugin: {
          Name: COMMANDS.name,
          UUID: COMMANDS.uuid,
          Version: COMMANDS.version,
        },
        Settings: {
          command: binding.command,
          args: binding.args ?? [],
          title: binding.title,
        },
        States: [keyState(binding.title)],
        UUID: `${COMMANDS.uuid}.run`,
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
      // Elgato's own action, wearing our artwork: it turns the page, and
      // `page-key.ts` draws the face so the key looks like the deck it's on.
      return {
        ...base,
        Name: "Next Page",
        Settings: {},
        States: [drawnState(binding.title, NEXT_PAGE_IMAGE)],
        UUID: "com.elgato.streamdeck.page.next",
      }
    case "multimedia":
      return {
        ...base,
        Name: "Multimedia",
        Settings: { actionIdx: binding.actionIdx },
        States: [keyState(binding.title)],
        UUID: "com.elgato.streamdeck.system.multimedia",
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

  const assets: Record<string, string> = {}
  pages.forEach((page, index) => {
    const uuid = pageUuids[index]
    if (!uuid) {
      return
    }
    files[`Profiles/${uuid}/manifest.json`] = pageManifest(page)
    // The face is per page, not per profile: it names the page it leads to and
    // marks the one it sits on, so each page gets its own copy in its own
    // folder — which is also the only place the app looks for it.
    const next = page.keys.find((key) => key?.kind === "nextPage")
    if (next?.kind === "nextPage") {
      assets[`Profiles/${uuid}/${NEXT_PAGE_IMAGE}`] = renderPageKey({
        label: next.title,
        index,
        total: pages.length,
      })
    }
  })

  return { dirName: `${profileUuid}.sdProfile`, files, assets }
}
