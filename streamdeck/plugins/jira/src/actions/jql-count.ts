import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { countState, issueNavigatorUrl, jqlCount } from "../jira"

export type JqlCountSettings = {
  /** JQL to count. Defaults to your open, unfinished issues. */
  jql?: string
  /** Site host or URL; falls back to JIRA_BASE_URL. */
  baseUrl?: string
  email?: string
  apiToken?: string
  /** Count at/above which the key flips to the "attention" state. */
  warnAt?: number
  /** Seconds between refreshes. */
  refreshSeconds?: number
}

const DEFAULT_JQL = "assignee = currentUser() AND statusCategory != Done"
const DEFAULT_REFRESH_SECONDS = 300

/**
 * Count of issues matching a JQL query.
 *
 * Reads credentials from `~/.config/streamdeck/secrets.env` like every other
 * key here, rather than keeping a second copy in a Property Inspector.
 */
export class JqlCount extends SingletonAction<JqlCountSettings> {
  override manifestId = "com.dmoraes.jira.jql-count"

  private readonly timers = new Map<string, NodeJS.Timeout>()

  override async onWillAppear(
    ev: WillAppearEvent<JqlCountSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.refresh(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<JqlCountSettings>,
  ): Promise<void> {
    const timer = this.timers.get(ev.action.id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(ev.action.id)
    }
    return Promise.resolve()
  }

  override async onKeyDown(ev: KeyDownEvent<JqlCountSettings>): Promise<void> {
    const settings = ev.payload.settings
    const base = settings.baseUrl || process.env.JIRA_BASE_URL
    if (base) {
      streamDeck.system.openUrl(
        issueNavigatorUrl(base, settings.jql ?? DEFAULT_JQL),
      )
    }
    await this.refresh(ev.action, settings)
  }

  private schedule(
    action: WillAppearEvent<JqlCountSettings>["action"],
    settings: JqlCountSettings,
  ): void {
    const existing = this.timers.get(action.id)
    if (existing) {
      clearInterval(existing)
    }
    const seconds = Math.max(
      settings.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
      30,
    )
    const timer = setInterval(() => {
      void this.refresh(action, settings)
    }, seconds * 1_000)
    // Don't hold the plugin process open just for the poll loop.
    timer.unref?.()
    this.timers.set(action.id, timer)
  }

  private async refresh(
    action: WillAppearEvent<JqlCountSettings>["action"],
    settings: JqlCountSettings,
  ): Promise<void> {
    try {
      const n = await jqlCount(settings.jql ?? DEFAULT_JQL, {
        baseUrl: settings.baseUrl || process.env.JIRA_BASE_URL,
        email: settings.email || process.env.JIRA_EMAIL,
        apiToken: settings.apiToken || process.env.JIRA_API_TOKEN,
      })
      await action.setTitle(String(n))
      // setState only applies to keys; guard for dials/other controls.
      if ("setState" in action) {
        await action.setState(countState(n, settings.warnAt ?? 1))
      }
    } catch (error) {
      streamDeck.logger.error(
        `jql-count failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      await action.setTitle("!")
    }
  }
}
