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

Shows what your status **actually is** — status from `users.profile.get`,
presence from `users.getPresence`, both every 60s. Slack is the only source of
truth: a status or presence changed anywhere else shows up here too.

Presence is checked first, because being away is the more consequential fact
and the one a status string can't express — Slack shows you as away whatever
your status says.

### Colours

The key borrows Slack's own vocabulary, so it needs no learning:

| Mode   | Key         | Matching Slack |
| ------ | ----------- | -------------- |
| Online | solid green | the active dot |
| Focus  | red         | do-not-disturb |
| Away   | hollow grey | the away dot   |

A status you set by hand reads as **online**, not focus — red has to keep
meaning "notifications are off" or it stops being information.

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

### Scopes

Setting a status is one API call; presence and notifications are two more,
each behind its own scope. A token without them still applies the status, and
the command reports which part didn't take rather than silently half-working.

| Scope                 | Needed for                            | Without it            |
| --------------------- | ------------------------------------- | --------------------- |
| `users.profile:write` | the status itself                     | nothing works         |
| `users.profile:read`  | showing the current status on the key | key shows `!`         |
| **`users:write`**     | `away` being a real presence change   | you stay "online"     |
| **`dnd:write`**       | `focus` actually silencing Slack      | 🔕 is decoration only |

That last row is the one worth dwelling on: a 🔕 status emoji **tells people**
something and **mutes nothing**. Snoozing is `dnd.setSnooze`, a separate call.

| `users:read` | reading presence back | the key can't see Away

**Why that last one matters.** Away carries no status text, so from the profile
alone it is byte-identical to Online. An earlier version inferred it from a
local record of the last press — which went stale the instant Slack flipped you
back to active on any interaction, with nothing able to detect it. That record
is gone; the key asks Slack.
