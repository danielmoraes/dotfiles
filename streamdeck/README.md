# Stream Deck configuration

Version-controlled configuration for an **Elgato Stream Deck +** (8 keys + 4 dials/touch-LCD) on **macOS**.

This directory holds everything that *can* live in git: the layout plan, the
macOS "glue" scripts that keys invoke, the list of plugins to install, custom
plugin source, and a bootstrap installer. The parts that live inside the Elgato
app itself (profiles) are exported to `profiles/` as `.streamDeckProfile`
bundles so a new machine can be brought up quickly.

## What's here

| Path | Purpose |
|---|---|
| [`layout/streamdeck-plus-layout.md`](layout/streamdeck-plus-layout.md) | The page-by-page plan for the 8 keys + 4 dials. Source of truth for how the deck is arranged. |
| [`plugins/README.md`](plugins/README.md) | Every plugin to install, where it comes from, version, and config notes. |
| [`scripts/`](scripts/README.md) | TypeScript "glue" commands that keys call (switch Claude account, focus mode, etc.) — typed + unit-tested, built to `sd-*` executables. |
| [`profiles/`](profiles/README.md) | Exported `.streamDeckProfile` bundles + how to export/import them. |
| [`icons/`](icons/README.md) | Custom key icons. |
| [`install.sh`](install.sh) | Bootstrap: checks for the app + CLI, links scripts, prints the plugin checklist. |

## Quick start on a new Mac

```sh
# 1. Install the Stream Deck app (Homebrew)
brew install --cask elgato-stream-deck

# 2. Run the bootstrap (links scripts into ~/.local/bin, prints plugin checklist)
./streamdeck/install.sh

# 3. Install the plugins listed in plugins/README.md (Marketplace + a few from GitHub)

# 4. Import the profile(s) from profiles/ by double-clicking the .streamDeckProfile files
```

## Design principles

- **Glance-first.** Status keys (PRs, Slack, meetings, AI limits) are read-only
  and color-coded so the deck is useful without touching it.
- **Modern SDK where possible.** Prefer plugins built on Elgato's official
  Node.js SDK v2 (`@elgato/streamdeck`, manifest `SDKVersion: 3`, app 6.9+).
  See `plugins/README.md` for the per-plugin verdict.
- **Scripts stay in git, not in the app.** Keys use "Open"/"System → Open"
  actions pointing at the built `sd-*` commands, so behavior is
  version-controlled and testable, and the
  Elgato profile stays thin.
- **Secrets never land in git.** Tokens (GitHub, Slack, WakaTime, Jira) live in
  `~/.config/streamdeck/secrets.env` (git-ignored). Scripts and plugins read
  from there.

## Hardware note

This config targets the **Stream Deck +**: 8 LCD keys + a 4-dial touch strip.
Dials are used for continuous/rotary actions (volume, Pomodoro timer, agent
reasoning depth) and the touch strip shows live readouts. If you move to a
different model, the key pages still apply — you just lose the dial row.
