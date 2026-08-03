# weekly-metrics

Stream Deck plugin: this week's numbers on one key (Page 3 · K4). Press cycles
to the next metric.

## Action

| Action            | Controller | What it shows                                              |
| ----------------- | ---------- | ---------------------------------------------------------- |
| **Weekly Metric** | Keypad     | `LABEL` over `VALUE`, e.g. `CODE` / `12.5h`. Press cycles. |

## Metrics

The week runs **Monday 00:00 local** to now.

| Kind         | Label     | Source                                      | Needs                           |
| ------------ | --------- | ------------------------------------------- | ------------------------------- |
| `coding`     | `CODE`    | WakaTime summaries, in hours                | `WAKATIME_API_KEY`              |
| `prs-merged` | `PRS`     | GitHub search, `is:pr author:@me is:merged` | `GITHUB_TOKEN`                  |
| `commits`    | `COMMITS` | GitHub commit search                        | `GITHUB_TOKEN` + `GITHUB_LOGIN` |
| `meetings`   | `MTGS`    | Events in your iCal feed                    | `ICAL_URL`                      |

`commits` needs an explicit login because GitHub's commit search — unlike issue
search — has no `@me` shorthand.

## Settings

Settings come from [`../../profiles/src/layout.ts`](../../profiles/src/layout.ts)
— these plugins ship no Property Inspector, so a key's settings are whatever the
generated profile gives it. Anything left unset falls back to the environment
(see [`../../secrets/`](../../secrets/src/index.ts)).

| Setting                 | Default             | Notes                                                   |
| ----------------------- | ------------------- | ------------------------------------------------------- |
| `cycle`                 | all four            | Ordered list of metric kinds to cycle through.          |
| `current`               | first in `cycle`    | Written back on each press so a restart resumes here.   |
| `wakatimeApiKey`        | `$WAKATIME_API_KEY` |                                                         |
| `githubToken`           | `$GITHUB_TOKEN`     |                                                         |
| `githubLogin`           | `$GITHUB_LOGIN`     | Only needed for `commits`.                              |
| `icalUrl`               | `$ICAL_URL`         | Private feed URL.                                       |
| `includeAllDayMeetings` | `false`             | All-day entries are usually PTO/holidays, not meetings. |
| `refreshSeconds`        | `600`               | Poll interval; clamped to a 60s floor.                  |

A metric that can't load shows `!` as its value rather than blanking the key,
so a missing token is visible instead of silent.

## Calendar parsing

`src/ics.ts` is a deliberately partial RFC 5545 reader — enough for "how many
meetings this week", not a general iCalendar library. It handles folded lines,
`DTSTART` as date or date-time, `STATUS:CANCELLED`, `EXDATE`, and `RRULE` with
`FREQ=DAILY|WEEKLY` plus `INTERVAL`, `COUNT`, `UNTIL` and `BYDAY`.

Known limits, all deliberate:

- **Monthly/yearly recurrence isn't expanded** — only the series' start date is
  counted. Rare for meetings, and a wrong expansion is worse than none.
- **`RDATE` and `BYSETPOS` are ignored** (e.g. "last Friday of the month").
- **Timezones are approximate**: a `Z` suffix is UTC, everything else —
  including `TZID=` — is read as local wall-clock time. Correct for bucketing
  into a week except within an hour of the boundary.
- **All-day entries are excluded** by default.

## Develop

```sh
pnpm install                                          # repo-root workspace
pnpm -C streamdeck/plugins/weekly-metrics check       # oxfmt + oxlint + typecheck
pnpm -C streamdeck/plugins/weekly-metrics test        # vitest
pnpm -C streamdeck/plugins/weekly-metrics build       # -> .sdPlugin/bin/plugin.js
```
