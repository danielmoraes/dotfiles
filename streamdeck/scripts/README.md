# scripts (macOS glue commands)

The commands Stream Deck keys invoke — summon agents, focus/meeting mode,
quick capture, standup — written in TypeScript so they're typed, testable, and
share the workspace toolchain (oxlint + oxfmt + vitest + tsdown, TypeScript 7).

Claude account switching lives outside this package now: the `cswap` CLI
(`claude-swap` on PyPI) owns that job, and the `cswap` Stream Deck plugin
(`../plugins/cswap/`) is its face on the deck. An earlier
`sd-switch-claude-account` command managed its own separate
`~/.claude/accounts/` symlink store; it was never wired to a key and is gone.

## Design

IO is isolated behind a small injectable `Ctx` (`src/lib/ctx.ts`) wrapping the
shell, filesystem, environment, clock, and notifications. That keeps the
decision logic pure and unit-testable, while the thin runtime shells out to
`osascript`, `shortcuts`, `gh`, `curl`, and `pbcopy`.

```
src/
  lib/         pure helpers (terminal/command building, standup dates, Slack
               payloads, capture formatting) + Ctx runtime
  commands/    one module per command: run(ctx, args)
  bin/         executable entrypoints (node shebang) wiring realCtx() -> run()
```

## Commands

| Command            | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| `sd-summon-agent`  | Launch `claude` \| `codex` \| `pi` in a terminal                           |
| `sd-summon-claude` | Open a terminal in the repo and start Claude Code, optional prompt         |
| `sd-focus-mode`    | Toggle deep-work Focus (Shortcut + Slack status)                           |
| `sd-meeting-mode`  | Toggle meeting mode (Focus/mic Shortcut)                                   |
| `sd-quick-capture` | Prompt and append to inbox, or open a GitHub issue                         |
| `sd-standup`       | Copy a summary of merged PRs since yesterday to the clipboard              |
| `sd-slack-status`  | Cycle Slack status (available / focus / lunch / clear), or set one by name |

## Develop

```sh
pnpm install          # at the repo-root workspace
pnpm run check        # oxfmt + oxlint + typecheck
pnpm test             # vitest
pnpm run build        # tsdown -> bin/<name>.js (executable, node shebang)
```

`install.sh` (repo `streamdeck/`) builds these and symlinks each command into
`~/.local/bin` as `sd-<name>`. Stream Deck keys use a **System → Open** action
pointing at the `sd-<name>` executable.

Config comes from `~/.config/streamdeck/secrets.env` (scaffolded by
`install.sh`): `STREAMDECK_TERMINAL`, `STREAMDECK_DEFAULT_REPO`,
`STREAMDECK_INBOX`, `SLACK_TOKEN`.

Neither mode command touches a music player any more. Both drove Spotify over
AppleScript — `sd-focus-mode` started `STREAMDECK_FOCUS_PLAYLIST`,
`sd-meeting-mode` paused playback — and `tell application "Spotify"` _launches_
Spotify when it isn't running, so without it installed the key opened an unused
app. Put it in the "Focus On" / "Meeting On" Shortcut instead, where it can name
whichever player is actually in use.

`realCtx()` loads that file itself via [`../secrets/`](../secrets/src/index.ts).
Keys invoke these commands through the Stream Deck app, which passes the _login_
environment rather than a shell's — so anything exported from a shell rc is
invisible here and the tokens have to be read off disk.

The compiled `bin/` is a git-ignored build artifact — run `pnpm run build`
(or `install.sh`) after cloning.
