# Profiles

The deck's profile is **generated from this repo**, not exported from the app.

[`src/layout.ts`](src/layout.ts) is the source of truth: 3 pages × (8 keys +
4 dials), written as data. [`src/profile.ts`](src/profile.ts) serialises that
into the app's on-disk format, and [`src/generate.ts`](src/generate.ts) installs
it.

## Apply the layout

```sh
# The app flushes its in-memory profiles on exit, so it must be quit first.
osascript -e 'tell application "Elgato Stream Deck" to quit'

pnpm -C streamdeck/profiles apply     # writes the profile + makes it active

open -a "Elgato Stream Deck"
```

The generator refuses to run while the app is up, rather than having its work
silently overwritten.

It is idempotent: profile and page UUIDs are derived from their names, so
re-running rewrites the same profile instead of piling up copies.

## What it writes

Stream Deck stores profiles as plain JSON under
`~/Library/Application Support/com.elgato.StreamDeck/ProfilesV3/`:

```text
<PROFILE-UUID>.sdProfile/
  manifest.json                        device + ordered page list
  Profiles/<PAGE-UUID>/manifest.json   one per page: its keys and dials
```

Each page manifest holds a `Controllers` array — one entry for the Keypad, one
for the Encoder row — mapping a `"col,row"` slot to an action.

Two things live outside the bundle, and the generator handles both:

- **The device UUID** is a hardware serial, so it can't be committed. It's read
  off any existing profile the app has already written for the deck.
- **Which profile is active** lives in
  `~/Library/Preferences/com.elgato.StreamDeck.plist`, not in the bundle —
  writing the bundle alone would leave the deck on its previous profile.

## Changing the layout

Edit `src/layout.ts` and re-run the build. Keep
[`../layout/streamdeck-plus-layout.md`](../layout/streamdeck-plus-layout.md) in
step — that document explains the _why_, `layout.ts` is what actually ships.

Every action UUID in the layout must belong to a plugin listed in
[`../plugins/README.md`](../plugins/README.md). `pnpm -C streamdeck/profiles test`
checks the structural invariants: all 8 keys and 4 dials filled on every page,
K8 always advances the page, action UUIDs prefixed by their plugin's UUID, and
no duplicate action ids.

## Why not `.streamDeckProfile` exports?

An exported bundle is an opaque zip that has to be re-exported by hand after
every tweak, and it embeds the device serial. Generating from `layout.ts` keeps
the deck reviewable in a diff and reproducible on a new machine with one
command.
