import { execFileSync } from "node:child_process"
import { readdir, readFile, rm, mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { type Device, buildProfile } from "./profile.ts"

/**
 * Discover the connected deck and write the generated profile into the Stream
 * Deck app's support directory.
 *
 * The app must be quit while this runs — it holds `ProfilesV3` in memory and
 * flushes on exit, so writing underneath a running app loses the changes.
 */

export const SUPPORT_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "com.elgato.StreamDeck",
)
export const PROFILES_DIR = join(SUPPORT_DIR, "ProfilesV3")

/** Stream Deck + (8 keys + 4 dials). Other models need a different layout. */
export const STREAM_DECK_PLUS_MODEL = "20GBD9901"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Find the Stream Deck + by reading the `Device` block off any existing
 * profile.
 *
 * The device UUID is a hardware serial, so it can't be hardcoded in the repo —
 * but the app writes it into every profile it owns, which makes any existing
 * profile a reliable source for it.
 */
export function findDevice(
  manifests: readonly unknown[],
  model = STREAM_DECK_PLUS_MODEL,
): Device | null {
  for (const manifest of manifests) {
    if (!isRecord(manifest) || !isRecord(manifest.Device)) {
      continue
    }
    const { Model, UUID } = manifest.Device
    if (Model === model && typeof UUID === "string") {
      return { Model, UUID }
    }
  }
  return null
}

/** Read every top-level profile manifest under `ProfilesV3`. */
export async function readProfileManifests(
  profilesDir = PROFILES_DIR,
): Promise<{ dir: string; manifest: unknown }[]> {
  let entries: string[]
  try {
    entries = await readdir(profilesDir)
  } catch {
    return []
  }
  const out: { dir: string; manifest: unknown }[] = []
  for (const entry of entries) {
    if (!entry.endsWith(".sdProfile")) {
      continue
    }
    try {
      const raw = await readFile(
        join(profilesDir, entry, "manifest.json"),
        "utf8",
      )
      out.push({ dir: entry, manifest: JSON.parse(raw) })
    } catch {
      // Unreadable or partially-written profile — skip it.
    }
  }
  return out
}

/** Profile directories whose manifest `Name` matches, for cleanup. */
export function profilesNamed(
  manifests: readonly { dir: string; manifest: unknown }[],
  name: string,
): string[] {
  return manifests
    .filter(({ manifest }) => isRecord(manifest) && manifest.Name === name)
    .map(({ dir }) => dir)
}

/** Write a built profile's files under `profilesDir`. */
export async function writeProfile(
  profile: { dirName: string; files: Record<string, unknown> },
  profilesDir = PROFILES_DIR,
): Promise<string> {
  const root = join(profilesDir, profile.dirName)
  await rm(root, { recursive: true, force: true })
  for (const [relative, contents] of Object.entries(profile.files)) {
    const target = join(root, relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, `${JSON.stringify(contents, null, 2)}\n`)
  }
  return root
}

/** Remove profiles the app owns for a given plugin UUID (or by name). */
export async function removeProfiles(
  dirs: readonly string[],
  profilesDir = PROFILES_DIR,
): Promise<void> {
  for (const dir of dirs) {
    await rm(join(profilesDir, dir), { recursive: true, force: true })
  }
}

export const PREFS_PLIST = join(
  homedir(),
  "Library",
  "Preferences",
  "com.elgato.StreamDeck.plist",
)

/** True while the Stream Deck app is running (it must be quit to write). */
export function isAppRunning(): boolean {
  try {
    execFileSync("pgrep", ["-f", "MacOS/Stream Deck"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/**
 * Point the device at a profile.
 *
 * Which profile a deck shows lives in the app's preferences plist, not in the
 * profile bundle — so writing the bundle alone leaves the deck on whatever it
 * showed before. `cfprefsd` caches the plist, hence the cache drop afterwards.
 */
export function setPreferredProfile(
  deviceUuid: string,
  profileUuid: string,
  plist = PREFS_PLIST,
): void {
  const key = `:Devices:${deviceUuid}:ESDProfilesInfo:ESDProfilesPreferred`
  execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", `Set ${key} ${profileUuid.toLowerCase()}`, plist],
    { stdio: "ignore" },
  )
  try {
    execFileSync("killall", ["cfprefsd"], { stdio: "ignore" })
  } catch {
    // cfprefsd not running — nothing cached to drop.
  }
}

export { buildProfile }
