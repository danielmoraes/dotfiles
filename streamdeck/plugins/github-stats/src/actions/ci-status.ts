import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
} from "@elgato/streamdeck"
import { githubToken } from "streamdeck-secrets"
import { type Conclusion, latestRunConclusion } from "../github"

export type CiStatusSettings = {
  /** "owner/name". */
  repo?: string
  /** Branch to check; defaults to the repo's default branch on GitHub if omitted. */
  branch?: string
  apiBase?: string
  token?: string
  openUrl?: string
}

const LABEL: Record<Conclusion, string> = {
  success: "OK",
  failure: "FAIL",
  pending: "…",
  unknown: "?",
}

/**
 * Which conclusions turn the key red.
 *
 * Only an actual failure — a build still running, or one we couldn't read,
 * isn't news. Crying wolf on `pending` would make the colour meaningless.
 */
export function ciState(conclusion: Conclusion): 0 | 1 {
  return conclusion === "failure" ? 1 : 0
}

/**
 * Green/red CI state for a repo's branch on the key. `manifestId` must match
 * this action's UUID in manifest.json (see SearchCount for the rationale).
 */
export class CiStatus extends SingletonAction<CiStatusSettings> {
  override manifestId = "com.dmoraes.github-stats.ci-status"

  override onWillAppear(ev: WillAppearEvent<CiStatusSettings>): Promise<void> {
    return this.refresh(ev.action, ev.payload.settings)
  }

  override async onKeyDown(ev: KeyDownEvent<CiStatusSettings>): Promise<void> {
    if (ev.payload.settings.openUrl) {
      streamDeck.system.openUrl(ev.payload.settings.openUrl)
    }
    await this.refresh(ev.action, ev.payload.settings)
  }

  private async refresh(
    action: WillAppearEvent<CiStatusSettings>["action"],
    settings: CiStatusSettings,
  ): Promise<void> {
    const repo = settings.repo
    if (!repo) {
      await action.setTitle("set repo")
      return
    }
    const token = settings.token || githubToken()
    try {
      const c = await latestRunConclusion(repo, settings.branch ?? "main", {
        apiBase: settings.apiBase,
        token,
      })
      await action.setTitle(LABEL[c])
      // setState only applies to keys; guard for dials/other controls.
      if ("setState" in action) {
        await action.setState(ciState(c))
      }
    } catch {
      await action.setTitle("!")
      if ("setState" in action) {
        await action.setState(1)
      }
    }
  }
}
