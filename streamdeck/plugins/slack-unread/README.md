# slack-unread

Stream Deck plugin: unread Slack mentions/DMs on a key (Page 2 · K5).

## Action

| Action           | Controller | What it shows                                                                           |
| ---------------- | ---------- | --------------------------------------------------------------------------------------- |
| **Unread Count** | Keypad     | Combined unread count; flips to a red "attention" state at `warnAt`. Press opens Slack. |

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

Slack has no public "give me my badge number" endpoint. The public
`conversations.*` methods would need one request per conversation, so this uses
`users.counts` — the endpoint Slack's own clients call for the unread badge. It
returns every conversation's unread state in a single request.

That endpoint is undocumented, so treat it as best-effort: it needs a user
token, and Slack could change it. The plugin fails soft (the key shows `!`)
rather than throwing.

DMs count whole conversations (`dm_count` — every DM is addressed to you);
channels and group DMs count only explicit `@`-mentions, which is what actually
warrants a key.

## Token

Create a user token with the `client` or `read` scope at
[api.slack.com/apps](https://api.slack.com/apps), then put it in
`~/.config/streamdeck/secrets.env` as `SLACK_TOKEN=` (git-ignored).

## Develop

```sh
pnpm install                                        # repo-root workspace
pnpm -C streamdeck/plugins/slack-unread check       # oxfmt + oxlint + typecheck
pnpm -C streamdeck/plugins/slack-unread test        # vitest
pnpm -C streamdeck/plugins/slack-unread build       # -> .sdPlugin/bin/plugin.js
```
