# cswap (Claude Accounts)

Every managed Claude account's usage limits on the touch strip, the active one
marked, and one press to switch between them. Lives on **D1**.

```
5H WINDOW                    3h 59m
● dmoraes                        2%
  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
○ formfactory                   40%
  ████████████▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
```

- **⟳ Rotate** — change the window: 5h → 7d → spend.
- **→ Press** — switch account.

## Why this exists

Two dials here (AgentDeck's Claude gauge and AI Usage Limits) both showed the
quota of whichever account you happen to be signed in as — the same number
twice, from two daemons. Neither could see the _other_ account, which is the
thing actually worth a dial when you run two. Both are gone; this took their
place, covering the signed-in account as one row of several, and needs no
daemon at all.

## Where the data comes from

Everything is [`cswap`](https://github.com/realiti4/claude-swap) (the
`claude-swap` package), shelled out to — the same arrangement as the Slack
status key and `sd-slack-status`: the CLI owns the behaviour, the dial is its
face. cswap already holds the OAuth tokens, the macOS Keychain entries and the
usage API, and it speaks a versioned JSON schema meant for exactly this:

```sh
cswap --list --json     # every account, its usage, which is active
cswap --switch --json   # rotate to the next account
```

Nothing here reads `secrets.env` — cswap keeps its own credentials, so this is
the one plugin in the repo that needs no token.

It's invoked by absolute path (`~/.local/bin/cswap`) because the Stream Deck app
runs under launchd with a four-entry `PATH`. The binary itself is fine to exec
from there: it's a uv tool shim whose shebang points at an absolute interpreter.

**AgentDeck was the obvious thing to fork** — it's MIT, and it already ran the
dial this replaced, plus page 1's session keys, which it still does. But it has
no multi-account concept at all: its integration model is one
linked account per _provider_ (Claude Code, Codex, OpenClaw…), each reading
whatever that CLI is currently signed into. Adopting its Swift daemon and bridge
protocol to add what cswap already answers in one JSON call wasn't worth it.

## Reading the strip

- **Filled dot + white name** is the active account; the rest are outlined and
  grey. It's marked twice over because "which one am I on" is the question the
  dial exists to answer, and it has to survive a glance.
- **Bar colour** follows the deck's convention — blue is quiet, red needs
  attention — with the amber the calendar key already uses for the middle:
  blue under 50%, amber 50–79%, red at 80%+.
- **A dash and an empty track** means that account has no such limit (only some
  plans carry a spend cap). Deliberately not a 0% bar, which would look
  identical to "you've spent nothing" while meaning the opposite.
- **A word instead of a percentage** — `expired`, `locked`, `no login`,
  `api key`, `n/a` — is cswap saying it couldn't read a quota, in the fewest
  words that still name the fix. A locked Keychain isn't an expired token.

## Why it draws SVG, when every key here is a static image

Keys pick between pre-authored images with `setState` and write their value with
`setTitle`. A dial has neither: the LCD strip is drawn only through
`setFeedback`, whose one full-canvas `pixmap` item takes an image. So a dial
showing live values has to generate one. Both third-party dials on this deck do
the same. `src/render.ts` is pure — accounts in, markup out — so the layout is
tested by asserting on the SVG rather than by looking at hardware.

## Settings

| Setting          | Default    | What it does                               |
| ---------------- | ---------- | ------------------------------------------ |
| `refreshSeconds` | `60`       | Poll interval, floored at 15               |
| `labels`         | derived    | Override an account's name, keyed by email |
| `strategy`       | `"rotate"` | How a press picks the next account         |

Names are derived from the email's **domain** (`someone@example.org` →
`example`), because the local part is usually identical across your accounts and
the organisation name is auto-generated boilerplate for personal ones. Override
when the derived word isn't the one you think in, keyed by email **or** by
cswap slot number:

```ts
settings: { labels: { "1": "personal", "2": "work" } }
```

Email is the more robust key — it survives accounts being reordered — but the
number exists so a config that lives in a public repo (like this one's
`layout.ts`) doesn't have to publish an address just to rename a bar. Email
wins when both match, and anything unlisted falls back to the derived name.

`strategy` is `rotate` (cswap's plain `--switch`: next slot, which with two
accounts is just a toggle), or `best` / `next-available` to hand the choice to
cswap's own quota-aware strategies.

`refreshSeconds` is floored at 15 because cswap caches usage for ~30s and
refreshes on demand — polling faster only spawns processes without ever showing
a newer number.

## Develop

```sh
pnpm -C streamdeck/plugins/cswap test
pnpm -C streamdeck/plugins/cswap build   # -> com.dmoraes.cswap.sdPlugin/bin/plugin.js
```

The `.sdPlugin` folder is symlinked into the app's `Plugins/` directory, so a
rebuild needs only a restart of the Stream Deck app — see
[`../README.md`](../README.md).
