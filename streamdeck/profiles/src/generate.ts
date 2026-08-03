import { PAGES, PROFILE_NAME } from "./layout.ts"
import {
  PROFILES_DIR,
  buildProfile,
  findDevice,
  isAppRunning,
  profilesNamed,
  readProfileManifests,
  removeProfiles,
  setPreferredProfile,
  writeProfile,
} from "./install.ts"

/**
 * Write the repo's deck layout into the Stream Deck app.
 *
 * Quit the Stream Deck app first — it flushes its in-memory profiles on exit
 * and would overwrite whatever this writes.
 *
 * Run with `pnpm -C streamdeck/profiles apply` (plain `node`, no build step —
 * Node 24 strips the types).
 */

if (isAppRunning()) {
  throw new Error(
    "The Stream Deck app is running and would overwrite these changes.\n" +
      "Quit it first:  osascript -e 'tell application \"Elgato Stream Deck\" to quit'",
  )
}

const manifests = await readProfileManifests()
const device = findDevice(manifests.map((entry) => entry.manifest))

if (device === null) {
  throw new Error(
    "No Stream Deck + found in ProfilesV3.\n" +
      "Connect the deck, open the Stream Deck app once so it creates a profile,\n" +
      "quit the app, then re-run this.",
  )
}

console.log(`Device: ${device.Model} ${device.UUID}`)

// Replace any previous copy of this profile so re-runs don't accumulate.
const stale = profilesNamed(manifests, PROFILE_NAME)
if (stale.length > 0) {
  await removeProfiles(stale)
  console.log(`Removed ${stale.length} previous "${PROFILE_NAME}" profile(s)`)
}

const profile = buildProfile(device, PAGES, PROFILE_NAME)
const root = await writeProfile(profile)

console.log(`Wrote ${profile.dirName} (${PAGES.length} pages)`)
for (const [index, page] of PAGES.entries()) {
  const keys = page.keys.filter(Boolean).length
  const dials = page.dials.filter(Boolean).length
  console.log(`  ${index + 1}. ${page.title} — ${keys} keys, ${dials} dials`)
}
// Writing the bundle isn't enough: the deck keeps showing whatever profile the
// preferences plist points at, so switch that over too.
const profileUuid = profile.dirName.replace(/\.sdProfile$/, "")
setPreferredProfile(device.UUID, profileUuid)
console.log(`Set as the active profile for ${device.Model}`)

console.log(`\n${root.replace(PROFILES_DIR, "ProfilesV3")}`)
console.log("Start the Stream Deck app to pick it up.")
