import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
} from "@elgato/streamdeck"
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
 * Green/red CI state for a repo's branch on the key. `manifestId` must match
 * this action's UUID in manifest.json (see SearchCount for the rationale).
 */
export class CiStatus extends SingletonAction<CiStatusSettings> {
  override manifestId = "org.dmoraes.github-stats.ci-status"

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
    const token = settings.token ?? process.env.GITHUB_TOKEN
    try {
      const c = await latestRunConclusion(repo, settings.branch ?? "main", {
        apiBase: settings.apiBase,
        token,
      })
      await action.setTitle(LABEL[c])
    } catch {
      await action.setTitle("!")
    }
  }
}
