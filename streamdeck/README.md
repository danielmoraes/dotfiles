# Stream Deck configuration

Version-controlled configuration for an **Elgato Stream Deck +** (8 keys +
4 dials/touch-LCD) on **macOS**.

Everything the deck does lives here — the page layout, the custom plugins, the
glue commands keys invoke, and the icons. The profile itself is _generated_ from
this repo rather than exported from the app, so the whole deck is reproducible
with one command.

## What's here

| Path                                                                   | Purpose                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`layout/streamdeck-plus-layout.md`](layout/streamdeck-plus-layout.md) | The page-by-page plan for the 8 keys + 4 dials, and why.                          |
| [`profiles/`](profiles/README.md)                                      | The layout **as data**, plus the generator that installs it into the app.         |
| [`plugins/`](plugins/README.md)                                        | Every plugin: what's installed, and the source of the three custom ones.          |
| [`scripts/`](scripts/README.md)                                        | TypeScript `sd-*` commands that keys call — typed, unit-tested.                   |
| [`secrets/`](secrets/src/index.ts)                                     | Loads `~/.config/streamdeck/secrets.env` for plugins and scripts.                 |
| [`ical/`](ical/src/index.ts)                                           | Reads the local macOS Calendar via `icalBuddy` (next meeting, weekly meetings).   |
| [`icons/`](icons/README.md)                                            | Icon style, and the generator for the PNG plugin icons.                           |
| [`install.sh`](install.sh)                                             | Bootstrap: builds and links the scripts and plugins, scaffolds secrets.           |

## Quick start on a new Mac

```sh
# 1. Install the Stream Deck app
brew install --cask elgato-stream-deck

# 2. Bootstrap: build + link the sd-* commands, scaffold secrets
./streamdeck/install.sh

# 3. Build + link the plugins (all of them live in plugins/)
pnpm run build

# 4. Write the 3-page profile onto the deck (app must be quit)
osascript -e 'tell application "Elgato Stream Deck" to quit'
pnpm -C streamdeck/profiles apply
open -a "Elgato Stream Deck"
```

Then fill in `~/.config/streamdeck/secrets.env` for the status keys.

## Design principles

- **Glance-first.** Status keys (PRs, Slack, meetings, CI) are read-only
  and colour-coded, so the deck is useful without touching it.
- **The layout is data.** [`profiles/src/layout.ts`](profiles/src/layout.ts) is
  the source of truth; the app's profile is generated from it and re-generating
  is idempotent. The deck is reviewable in a diff.
- **Modern SDK.** Every plugin the deck binds is built in this repo, on Elgato's
  Node.js SDK v2 (`SDKVersion: 3`) — see `plugins/README.md` for what was
  considered and dropped.
- **Logic in scripts, not in the app.** Keys use _Open_ actions pointing at the
  built `sd-*` commands, so behaviour is version-controlled and testable and the
  profile stays thin.
- **Secrets never land in git.** Tokens live in
  `~/.config/streamdeck/secrets.env` (git-ignored). GitHub falls back to
  `gh auth token`, so there's one fewer copy of a secret on disk.

## Checks

```sh
pnpm run check       # oxfmt + oxlint
pnpm run typecheck   # tsc across every package
pnpm test            # vitest across every package
pnpm run build       # bundle the plugins + scripts
```

## Hardware note

This targets the **Stream Deck +**: 8 LCD keys + a 4-dial touch strip. Dials
carry continuous/rotary actions (agent quota, volume) and the touch strip shows
live readouts. On a different model the key pages still apply — you
just lose the dial row, and `profiles/src/layout.ts` needs its `COLUMNS`/`ROWS`
and the model id in `profiles/src/install.ts` adjusted.
