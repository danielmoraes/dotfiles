# slack-unread

Stream Deck plugin: unread Slack mentions/DMs on a key (Page 2 · K5).

## Action

| Action           | Controller | What it shows                                                                  |
| ---------------- | ---------- | ------------------------------------------------------------------------------ |
| **Unread Count** | Keypad     | Slack's own badge number (DMs + mentions); red at `warnAt`. Press opens Slack. |

## Settings

Settings come from [`../../profiles/src/layout.ts`](../../profiles/src/layout.ts)
— these plugins ship no Property Inspector, so a key's settings are whatever the
generated profile gives it. Anything left unset falls back to the environment
(see [`../../secrets/`](../../secrets/src/index.ts)).

| Setting                                       | Default        | Notes                                                      |
| --------------------------------------------- | -------------- | ---------------------------------------------------------- |
| `token`                                       | `$SLACK_TOKEN` | **User** token (`xoxp-`), not a bot token.                 |
| `warnAt`                                      | `1`            | Count at/above which the key turns red.                    |
| `refreshSeconds`                              | `60`           | Poll interval; clamped to a 15s floor.                     |
| `openUrl`                                     | `slack://open` | Opened on press.                                           |
| `countDms` / `countMentions` / `countThreads` | all off        | All off = combined total. Enable some to count only those. |

## How the count is read

From the Slack **desktop app's own state file**, not the API:

```
~/Library/Application Support/Slack/storage/root-state.json
  webapp.teams.<TEAM_ID>.unreads = { unreads, unreadHighlights, showBullet }
```

Summed across signed-in workspaces, this is exactly the number Slack puts on its
dock badge — DMs plus mentions.

### Why not the API

- **`users.counts`** returns `not_allowed_token_type` for modern `xoxp-` tokens.
  It wants the legacy `client` scope, which can't be granted to apps created
  today. This plugin originally used it; it never worked.
- **`conversations.*`** has no unread concept. Reconstructing one means a
  `last_read` lookup plus a history scan _per conversation_ — hundreds of calls
  against a 50/min tier, for a key that refreshes every 30 seconds.

Reading the local file needs no token, no network, and no macOS privacy grant.

**The trade-offs, stated plainly:** it's an undocumented file that a Slack update
could reshape, and it only reflects reality while the desktop app is running.
Both fail soft — the key shows `–`, never a confident wrong number. The parser
throws rather than defaulting to zero if the shape changes.

## No token needed

This plugin reads a local file. `SLACK_TOKEN` in `~/.config/streamdeck/secrets.env`
is still used by `sd-slack-status` and `sd-focus-mode`, which _set_ your status
via `users.profile.set` — that endpoint does accept a modern user token.

## Develop

```sh
pnpm install                                        # repo-root workspace
pnpm -C streamdeck/plugins/slack-unread check       # oxfmt + oxlint + typecheck
pnpm -C streamdeck/plugins/slack-unread test        # vitest
pnpm -C streamdeck/plugins/slack-unread build       # -> .sdPlugin/bin/plugin.js
```
