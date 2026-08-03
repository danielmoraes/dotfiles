import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
} from "@elgato/streamdeck"
import { countState, searchCount } from "../github"

export type SearchCountSettings = {
  /** GitHub search query, e.g. "is:open is:pr review-requested:@me". */
  query?: string
  /** Override API base (GitHub Enterprise / testing). */
  apiBase?: string
  /** Token; falls back to GITHUB_TOKEN env for local dev. */
  token?: string
  /** Count at/above which the key flips to the "attention" state. */
  warnAt?: number
  /** URL opened on key press (e.g. the GitHub search page). */
  openUrl?: string
}

const DEFAULT_QUERY = "is:open is:pr review-requested:@me"

/**
 * Shows the number of results for a saved GitHub search on the key. One action,
 * many uses: "PRs to review", "my open PRs", "issues assigned to me" — just a
 * different query per key instance.
 *
 * `manifestId` must match this action's UUID in manifest.json. (Equivalent to
 * the SDK's `@action` decorator, set as a field so the bundle stays portable
 * across compilers that don't lower TC39 decorators.)
 */
export class SearchCount extends SingletonAction<SearchCountSettings> {
  override manifestId = "org.dmoraes.github-stats.search-count"

  override onWillAppear(
    ev: WillAppearEvent<SearchCountSettings>,
  ): Promise<void> {
    return this.refresh(ev.action, ev.payload.settings)
  }

  override async onKeyDown(
    ev: KeyDownEvent<SearchCountSettings>,
  ): Promise<void> {
    if (ev.payload.settings.openUrl) {
      streamDeck.system.openUrl(ev.payload.settings.openUrl)
    }
    await this.refresh(ev.action, ev.payload.settings)
  }

  private async refresh(
    action: WillAppearEvent<SearchCountSettings>["action"],
    settings: SearchCountSettings,
  ): Promise<void> {
    const query = settings.query ?? DEFAULT_QUERY
    const token = settings.token ?? process.env.GITHUB_TOKEN
    try {
      const n = await searchCount(query, { apiBase: settings.apiBase, token })
      await action.setTitle(String(n))
      // setState only applies to keys; guard for dials/other controls.
      if ("setState" in action) {
        await action.setState(countState(n, settings.warnAt ?? 1))
      }
    } catch {
      await action.setTitle("!")
    }
  }
}
