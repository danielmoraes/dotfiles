---
name: verify
description: Drive the Stream Deck + configuration in this repo — the sd-* commands and the custom plugins — and capture what the deck would actually show.
---

# Verifying the Stream Deck config

The surfaces here are a **CLI** (the `sd-*` commands a key invokes) and a
**socket** (the plugins, which speak the Stream Deck SDK WebSocket protocol).
Neither is exercised by the test suite in a way that catches the bugs that
actually bite, because of the environment gap below.

## The environment gap — reproduce it or your run is meaningless

Stream Deck is launched by **launchd**, whose `PATH` is only
`/usr/bin:/bin:/usr/sbin:/sbin` — no nvm, no Homebrew. If you launch the app
from a shell (`open -a "Elgato Stream Deck"`), it inherits _your_ rich `PATH`
and everything appears to work. That is a false pass.

Always drive with the bare environment:

```sh
env -i HOME="$HOME" PATH=/usr/bin:/bin:/usr/sbin:/sbin ~/.local/bin/sd-<name>
```

Two real bugs have been found this way and both regress silently:

- `#!/usr/bin/env node` in the built commands → `env: node: No such file or
directory`. `install.sh` now writes wrapper scripts with the interpreter
  pinned; if it ever goes back to `ln -s`, every key on pages 1 and 3 dies.
- `gh auth token` (the `GITHUB_TOKEN` fallback in `streamdeck/secrets`) →
  `gh` is not on that `PATH` either, so the GitHub keys paint `!`. Resolved
  via absolute candidate paths in `GH_CANDIDATES`.

## Driving the CLI surface

```sh
pnpm run build && ./streamdeck/install.sh
env -i HOME="$HOME" PATH=/usr/bin:/bin:/usr/sbin:/sbin ~/.local/bin/sd-slack-status
```

Safe to drive: `sd-slack-status`, `sd-switch-claude-account --current`,
`sd-standup`. **Avoid** `sd-focus-mode` / `sd-meeting-mode` (they toggle macOS
Focus, Slack status and music) and `sd-summon-*` (they open terminal windows).

To prove `loadSecrets()` really read `~/.config/streamdeck/secrets.env`, put a
value in the file that is _not_ in your shell env and watch the command take a
different branch. Back the file up and restore it.

## Driving the plugin surface

Don't import the plugin modules — that proves nothing. Spawn the real bundled
`bin/plugin.js` against a WebSocket server speaking the SDK handshake, replay
the `willAppear` the app sends for each key, and capture the `setTitle` /
`setState` that comes back: that _is_ what gets painted on the deck.

`streamdeck/plugins/github-stats/src/plugin.e2e.test.ts` is the reference for
the handshake (registration argv, `deviceDidConnect`, then `willAppear`). Read
it for the protocol, then write a throwaway driver that:

1. reads the installed profile at
   `~/Library/Application Support/com.elgato.StreamDeck/ProfilesV3/*.sdProfile/Profiles/*/manifest.json`
   so you drive the **real configured settings**, not invented ones;
2. spawns each plugin with `env: { HOME, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" }`;
3. prints the painted title per key.

Expected healthy output with tokens present: numeric counts for the
github-stats keys (`state=1` = red/attention), `no\ntoken` for slack-unread
when `SLACK_TOKEN` is blank, `LABEL\nvalue` for weekly-metrics.

A key that paints `!` means its fetch threw — usually a missing token or the
`PATH` gap above, not a logic bug.

## Applying / re-applying the profile

The app must be quit; the generator refuses otherwise and re-running is
idempotent.

```sh
osascript -e 'tell application "Elgato Stream Deck" to quit'
pnpm -C streamdeck/profiles apply
open -a "Elgato Stream Deck"
```

## Gotchas

- Plugins are **symlinked** into the app's `Plugins/` dir, so `pgrep -f
"Plugins/…"` will not match them — they run under their resolved repo path.
  Match on `dotfiles/streamdeck/plugins/` instead.
- Stream Deck stops a plugin whose actions aren't on the visible page, so
  "not running" often just means you're on another page.
- Manifest errors are silent apart from one line in
  `~/Library/Logs/ElgatoStreamDeck/StreamDeck.0.log` — grep it for `invalid`.
- `weekly-metrics` counts from **Monday 00:00**, so on a Monday the numbers are
  legitimately near zero. Cross-check against the API before calling it broken.
