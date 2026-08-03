# sessions

One key per live Claude Code session, on page 1 of the deck.

```
┌────────────────┐  ← teal dash orbiting  = running
│                │    amber ring breathing = wants you
│  stream deck   │    hairline             = idle
│  steward       │  the name you gave it, over the repo
│                │
│  ▓▓▓▓▓▓▓▓░ 87% │  context window
│  21m · 16:06   │  running for · started at      s002 ← terminal
└────────────────┘
```

Unnamed, it's the repo on top and the worktree below:

```
┌────────────────┐
│  steward       │
│  ⑂ calm-mappi… │
```

Read-only, and daemon-free: everything comes from files Claude Code already
writes.

## Telling seven sessions apart

Three things on the key are there to answer "which one is this", in order of
how much they're worth:

1. **The name you gave it.** `/rename` in the session and it takes the top
   line, with the repo demoted to the smaller line beneath as context.
2. **The worktree**, when there's no name. Then the repo leads and the slug
   sits under it, marked with a branch glyph.
3. **The terminal** (`s002`), bottom right. The only identifier that leads back
   to a window: run `tty` in any terminal and it prints the same thing.

Either way the top line answers "which session" and the second answers "where",
which is the order you read them in. The repo is on the key at all times —
which is the one thing AgentDeck's slot could never show.

## Why not AgentDeck's own session slot

This replaced it on page 1. The difference is mostly in how the key is spent.

AgentDeck's `session-slot` gives a quarter of the key to a Claude watermark,
states the state three times over (border colour, a `RUN`/`PERM`/`ACT` badge,
_and_ the word `RUNNING`), and then clips its one identity field to 13
characters. That field is `projectName`, the basename of `cwd` — so every
worktree arrives as an unrelated slug (`calm-mapping-twilight`,
`reflective-foraging-cerf`) and three sessions in the same repo are
indistinguishable at a glance.

None of it is configurable: the action carries no `PropertyInspectorPath` and
accepts no settings, and the artwork is a hardcoded SVG. So the choice was to
live with it or draw the key ourselves.

Here state lives **only** in the border, and the space that buys goes to the
things that actually differ between seven keys — identity, how full the
context window is, and how long it has been going.

Context usage is the one reading nothing on the deck showed before, and it's
the number most likely to change what you do next.

## Names

`/rename` writes the name into the session record, so it arrives with
everything else.

A session nobody has renamed carries a generated name and
`"nameSource": "derived"` — `graceful-wibbling-dewdrop-0d`, which is the
worktree slug plus two hex characters. That's worth nothing on a key already
showing the worktree, so derived names are ignored and only deliberate ones
displace the slug.

## Where the data comes from

Everything is read from files Claude Code already writes. There is no daemon
and no hook of ours in any session.

| Source                                               | Gives                              |
| ---------------------------------------------------- | ---------------------------------- |
| `~/.claude/sessions/<pid>.json`                      | cwd, name, status, start time, pid |
| `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` | context tokens                     |
| `/bin/ps -o tty= -p <pid>`                           | terminal                           |

Claude Code writes a record per running session and keeps it current:

```json
{
  "pid": 22112,
  "sessionId": "95fc184c-…",
  "cwd": "/Users/…/worktree",
  "startedAt": 1785784996705,
  "name": "stream deck",
  "status": "busy"
}
```

`status` is `busy`, `waiting`, or idle-ish, which is exactly the three states
the border needs. A record can outlive its session if Claude Code is killed
hard enough not to clean up, so each pid is checked with signal 0 before its
key is drawn — a key naming a session that ended an hour ago is worse than an
empty one.

The directory is re-read at most once a second and transcripts every five;
`ps` runs once per pid, since a process's controlling terminal never changes.
Repaints run at 10fps while any border is moving and drop to 1s when
everything is idle.

### This used to read the AgentDeck daemon

It doesn't any more, and the reason is worth keeping. The daemon knew all the
same facts, but one process further from the truth:

- **`contextPercent` divided by a hardcoded 200 000.** On a 1M-context model a
  session genuinely at 28% arrived as `140.3%`. Every reading on the deck was
  five times high, and looked plausible enough to ship.
- **`projectName` was the basename of `cwd`** — the worktree slug, not the
  repo. Three sessions in one repo were indistinguishable.
- **It knew nothing about `/rename`**, which is the best identifier available.

Three of the fields that mattered had to be computed here anyway. What was
left was `state`, which Claude Code's own `status` gives directly, and the
permission gate — the one thing genuinely lost, because answering a prompt
needs a hook holding the call open, which no file can provide.

Dropping it means AgentDeck can be uninstalled entirely, including the hooks
`@agentdeck/setup` writes into `~/.claude/settings.json` — of which
`PreToolUse` and `Stop` are **blocking** (`--max-time` 60s and 10s), so every
tool call in every session was waiting on a round-trip to it.

## Slots

Positional: the plugin sorts the visible keys by their coordinates and fills
them **oldest session first**. So the profile binds the same action to K1–K7
with no per-key settings, and moving a key moves which session it watches.

Oldest-first matters. Ordering by anything that changes — most recently active,
say — would shuffle sessions between keys while you watch, and the keys are
meant to be muscle memory. A new session lands on the first free key at the end
instead of pushing everything along.

## What a press does

Nothing. The key is a readout.

An earlier version answered permission prompts — press to allow, hold to deny
— by asking the AgentDeck daemon to release a `PreToolUse` hook it was holding
open. That went with the daemon. Getting it back means owning a blocking hook
in every session, which is a real cost to weigh against how often it fires:
in auto mode Claude never raises a permission prompt at all.

Jumping to the session's terminal is the other obvious thing to put here — the
key already shows which one it is — but resolving a `tty` to a window is
terminal-specific, so it's left open rather than guessed at.

## The context window

The bar needs a denominator and nothing on disk has one. Claude Code hands the
real `context_window_size` to the status line on stdin and persists it nowhere,
and the transcript records `claude-opus-5` whether the session is the 200k or
the 1M variant. So it's declared in the profile:

```ts
settings: {
  contextWindow: 1_000_000
}
```

Unset, it falls back to 200 000 — the same default Claude Code's own status
line uses. Set it wrong and every reading is off by the ratio, which is
exactly the bug inherited from the daemon.

The numerator is `input_tokens + cache_creation_input_tokens +
cache_read_input_tokens` of the most recent assistant message: the whole prompt
that message was produced from. Only the tail of the transcript is read, since
that message is at the end and the files run to megabytes.

## Development

```sh
pnpm -C streamdeck/plugins/sessions test    # unit + an e2e against the real bundle
pnpm -C streamdeck/plugins/sessions build
```

The e2e test spawns the actual built plugin against a mock Stream Deck and a
fixture `HOME`, then asserts on the painted SVG — which catches the failures
that are otherwise silent: a manifest the app rejects, and a plugin that can't
read the session directory or run `/bin/ps` under launchd's four-entry `PATH`.
