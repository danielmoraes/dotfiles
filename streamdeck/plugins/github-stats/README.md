# github-stats (custom Stream Deck plugin)

Shows GitHub counts and CI status on Stream Deck keys, built on Elgato's official
Node.js SDK v2 (`@elgato/streamdeck`, manifest `SDKVersion: 3`, app 6.9+).

Two actions, driven entirely by per-key settings so one action covers several
dashboard keys:

- **Search Count** (`org.dmoraes.github-stats.search-count`) — runs a GitHub
  issue/PR search and prints the match count. Flips to an "attention" state at a
  threshold. Use it for _PRs to review_, _my open PRs_, _issues assigned to me_.
- **CI Status** (`org.dmoraes.github-stats.ci-status`) — shows the latest Actions
  run conclusion for a repo/branch (`OK` / `FAIL` / `…`).

## Toolchain

Follows the Form Factory devtools standard:

- **`vite-plus` (`vp`)** — `vp check` runs **oxfmt + oxlint + typecheck** in one
  pass; `vp test --run` runs the test suite. Config in `vite.config.ts` (the
  shared oxlint rules + oxfmt style).
- **`tsdown`** — bundles the plugin entry into a single self-contained
  `bin/plugin.js` (config in `tsdown.config.ts`).
- **TypeScript 7** (`tsc --noEmit` for typechecking; `noEmit` because tsdown does
  the emit).

Managed as a package in the `streamdeck/plugins` pnpm workspace (catalog +
supply-chain hardening). Run `pnpm install` once at `streamdeck/plugins/`, then:

```sh
pnpm run check    # oxfmt + oxlint + typecheck
pnpm run build    # tsdown -> com.dmoraes.github-stats.sdPlugin/bin/plugin.js
pnpm test         # vp test --run (builds the bundle, then runs vitest)
```

## Verification (no hardware needed)

Because a plugin is just a Node process speaking the Stream Deck WebSocket
protocol, this plugin is tested without a physical deck or the Elgato app:

- **Unit tests** (`src/github.test.ts`) exercise the pure GitHub helpers with an
  injected `fetch` — no network.
- **e2e test** (`src/plugin.e2e.test.ts`) stands up a **mock Stream Deck**: a
  WebSocket server that performs the real registration handshake, announces a
  device, and sends a `willAppear` event to the _actual built plugin process_,
  then asserts the plugin replies with the correct `setTitle` command. A mock
  GitHub HTTP server supplies canned API responses. The bundle is built first by
  `vitest.global-setup.ts`.

What the e2e test proves end-to-end: argv parsing → WS register →
`manifest.json` load → action routing by UUID → GitHub fetch → `setTitle`
emission. The only things it can't cover are pixels on the physical LCD and the
Property Inspector UI.

## Build & install onto a real device

```sh
pnpm run build                                 # tsdown -> bin/plugin.js
# Add icons under com.dmoraes.github-stats.sdPlugin/imgs/ (see manifest paths)
pnpm add -g @elgato/cli
streamdeck link com.dmoraes.github-stats.sdPlugin   # sideload for development
# or package for the Marketplace / sharing:
streamdeck pack com.dmoraes.github-stats.sdPlugin
```

> The compiled `bin/` is a build artifact and is git-ignored — run `pnpm run
build` after cloning. Icons (`imgs/`) are not committed yet; the plugin runs
> without them but keys show blank art until you add them.
>
> Actions set `manifestId` as a field instead of using the SDK's `@action`
> decorator, so the bundle stays portable across compilers that don't lower
> TC39 decorators (tsdown/oxc). Each `manifestId` must match a UUID in
> `manifest.json`.

## Configuring keys (maps to `../../layout/streamdeck-plus-layout.md`)

Set these per key in the generated profile (`profiles/src/layout.ts`). A token with
`repo` + `read:org` scope is required for private data; store it once as a
global setting or read `GITHUB_TOKEN` from the environment for local dev.

| Dashboard key  | Action       | Key settings                                                                                      |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| PRs to review  | Search Count | `query: is:open is:pr review-requested:@me`, `openUrl: https://github.com/pulls/review-requested` |
| My open PRs    | Search Count | `query: is:open is:pr author:@me`, `warnAt: 1`                                                    |
| Tasks assigned | Search Count | `query: is:open is:issue assignee:@me`                                                            |
| CI status      | CI Status    | `repo: danielmoraes/dotfiles`, `branch: main`                                                     |

Settings reference:

- **Search Count**: `query`, `apiBase?`, `token?`, `warnAt?` (default 1),
  `openUrl?`.
- **CI Status**: `repo` (`owner/name`), `branch?` (default `main`), `apiBase?`,
  `token?`, `openUrl?`.

`apiBase` defaults to `https://api.github.com`; set it for GitHub Enterprise.
