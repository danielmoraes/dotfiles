# calendar

Stream Deck plugin: the next meeting from the **local macOS Calendar** (Page 2 · K6).

## Action

| Action           | Controller | What it shows                                                                                                                     |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Next Meeting** | Keypad     | `TITLE` over a countdown (`12m`, `1h05`, `now`). Amber at/under `warnMinutes`. `clear` when nothing's left. Press opens Calendar. |

## Why local, not an `.ics` feed

The obvious design is a private iCal URL. In practice Google Workspace domains
routinely disable the per-calendar **"Secret address in iCal format"**, which
leaves no private feed to subscribe to — and the only remaining option, the
_public_ address, requires making the calendar world-readable.

The same calendar is already synced into Calendar.app, so this reads there
instead via [`icalBuddy`](https://hasseg.org/icalBuddy/). No token to store, no
network call, and recurrence and timezones are resolved by EventKit rather than
by a partial RFC 5545 parser.

The shared reader lives in [`../../ical/`](../../ical/src/index.ts) and is also
used by `weekly-metrics` for its `MTGS` metric.

## Requirements

```sh
brew install ical-buddy
```

**Calendar permission.** The first time a key renders, macOS asks _"Elgato
Stream Deck would like to access your calendar"_ — approve it, or the key shows
`cal !`. The grant belongs to the Stream Deck app, not to `icalBuddy`, so
approving it in a terminal does **not** cover the deck. Check under System
Settings → Privacy & Security → Calendars.

## Settings

Set in [`../../profiles/src/layout.ts`](../../profiles/src/layout.ts); this
plugin ships no Property Inspector.

| Setting          | Default   | Notes                                                                    |
| ---------------- | --------- | ------------------------------------------------------------------------ |
| `calendars`      | all       | Restrict to these calendar names (as `icalBuddy calendars` prints them). |
| `warnMinutes`    | `10`      | Countdown at/under which the key turns amber.                            |
| `refreshSeconds` | `60`      | Poll interval; clamped to a 15s floor.                                   |
| `openUrl`        | `ical://` | Opened on press.                                                         |
| `includeAllDay`  | `false`   | All-day entries are OOO/holiday banners, not meetings.                   |

## Develop

```sh
pnpm -C streamdeck/plugins/calendar check   # oxfmt + oxlint + typecheck
pnpm -C streamdeck/plugins/calendar test    # vitest
pnpm -C streamdeck/plugins/calendar build   # -> .sdPlugin/bin/plugin.js
```

`src/render.ts` keeps the key-face decision pure — which event wins, when it
turns amber, what an empty calendar looks like — so it's testable without a
device or a calendar store. Tests never touch the real Calendar; they inject a
runner, which also keeps them green on the Linux CI runner where `icalBuddy`
doesn't exist.
