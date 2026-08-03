# Profiles

Exported Stream Deck profiles live here as `.streamDeckProfile` bundles so the
deck layout is reproducible on a new machine.

These are created **from the Elgato app on your Mac** — they can't be generated
headlessly, because they embed device-specific key/dial bindings and image
blobs. The workflow:

## Export (to save your current deck into git)

1. Open the Stream Deck app.
2. Top-right profile dropdown → **Export…** for each profile
   (e.g. `Agents`, `Work`, `Modes`).
3. Save the `.streamDeckProfile` files into this directory.
4. Commit them.

## Import (to set up a new Mac)

1. Double-click each `.streamDeckProfile` here, or in the app:
   profile dropdown → **Import…**.
2. Assign them to the Stream Deck + device.

## Building the layout the first time

Follow [`../layout/streamdeck-plus-layout.md`](../layout/streamdeck-plus-layout.md)
to lay out the 3 pages + dials, then export here. Suggested profile-per-page
setup so an app-specific profile (e.g. Meeting) can auto-activate:

- `Agents.streamDeckProfile`  — Page 1
- `Work.streamDeckProfile`    — Page 2
- `Modes.streamDeckProfile`   — Page 3

> Tip: keep the "next page" key (K8) bound to **Switch Profile** so the three
> chain in a loop. Or use a single profile with Folders if you prefer.

_(No profiles committed yet — export them from your Mac once the layout is built.)_
