# slack

Stream Deck plugin: two Slack keys — unread count (Page 2 · K5) and current
status (Page 2 · K7).

_(The plugin UUID is still `com.dmoraes.slack-unread` from when it did only the
first; renaming it would churn the installed plugin for no user-visible gain.)_

## Action

| Action           | Controller | What it shows                                                                  |
| ---------------- | ---------- | ------------------------------------------------------------------------------ |
| **Unread Count** | Keypad     | Slack's own badge number (DMs + mentions); red at `warnAt`. Press opens Slack. |
| **Slack Status** | Keypad     | Your current status — `Online` / `Focus` / `Away`. Press cycles.               |

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

## The status key

Shows what your status **actually is**, read from `users.profile.get` every 60s
— so a status you set in the Slack client shows up here too, and the key can't
drift from reality by claiming what it last set.

Pressing it runs `sd-slack-status`, which walks a three-state cycle:

| Mode    | Status                   | Presence |
| ------- | ------------------------ | -------- |
| `clear` | _(none)_                 | auto     |
| `focus` | 🔕 Focusing — back later | auto     |
| `away`  | 🌴 Away                  | **away** |

There's no separate "Available": an empty status already _is_ online and
available, so it would have been a step that looked different in Slack while
meaning the same thing.

A status set by hand in Slack that isn't one of these is shown as its own text
rather than mislabelled as one of ours.

### Presence needs an extra scope

`away` is a real presence change (`users.setPresence`), not just a status
string — showing online with an "Away" message is visible but still gettable.
That call needs the **`users:write`** scope. Without it the status still
applies and the command reports `presence: add the users:write scope` rather
than silently half-working.

Reading presence back would additionally need `users:read`. Without it, an
empty status can't be told apart from away by the API, so the key falls back to
its own record of what it last set.
