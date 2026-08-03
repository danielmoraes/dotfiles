import streamDeck, {
  SingletonAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck"
import { githubToken } from "streamdeck-secrets"
import {
  type MetricConfig,
  type MetricKind,
  LABELS,
  METRIC_KINDS,
  fetchMetric,
  isMetricKind,
  nextKind,
} from "../metrics"

export type MetricSettings = {
  /** Metrics to cycle through on press. Defaults to the full set. */
  cycle?: string[]
  /** Metric currently shown; persisted so the key survives a restart. */
  current?: string
  wakatimeApiKey?: string
  githubToken?: string
  githubLogin?: string
  icalUrl?: string
  includeAllDayMeetings?: boolean
  /** Seconds between refreshes. These move slowly; 10 min is plenty. */
  refreshSeconds?: number
}

const DEFAULT_REFRESH_SECONDS = 600

/**
 * One key, several weekly numbers: coding hours, PRs merged, commits, meetings.
 * Press cycles to the next metric in the configured order.
 *
 * The key renders as `LABEL\nVALUE` so it reads without an icon, and the
 * selected metric is written back to settings so a restart resumes where you
 * left off.
 */
export class MetricAction extends SingletonAction<MetricSettings> {
  override manifestId = "com.dmoraes.weekly-metrics.metric"

  /** One timer per visible key instance, keyed by action id. */
  private readonly timers = new Map<string, NodeJS.Timeout>()

  override async onWillAppear(
    ev: WillAppearEvent<MetricSettings>,
  ): Promise<void> {
    this.schedule(ev.action, ev.payload.settings)
    await this.render(ev.action, ev.payload.settings)
  }

  override onWillDisappear(
    ev: WillDisappearEvent<MetricSettings>,
  ): Promise<void> {
    this.clear(ev.action.id)
    return Promise.resolve()
  }

  override async onKeyDown(ev: KeyDownEvent<MetricSettings>): Promise<void> {
    const settings = ev.payload.settings
    const next = nextKind(currentKind(settings), cycleOf(settings))
    const updated: MetricSettings = { ...settings, current: next }
    await ev.action.setSettings(updated)
    // Re-arm the poll with the new settings. The interval closes over the
    // settings it was created with, so without this the next tick would repaint
    // the *previous* metric and undo the press.
    this.schedule(ev.action, updated)
    await this.render(ev.action, updated)
  }

  private schedule(
    action: WillAppearEvent<MetricSettings>["action"],
    settings: MetricSettings,
  ): void {
    this.clear(action.id)
    const seconds = Math.max(
      settings.refreshSeconds ?? DEFAULT_REFRESH_SECONDS,
      60,
    )
    const timer = setInterval(() => {
      void this.render(action, settings)
    }, seconds * 1_000)
    // Don't hold the plugin process open just for the poll loop.
    timer.unref?.()
    this.timers.set(action.id, timer)
  }

  private clear(actionId: string): void {
    const timer = this.timers.get(actionId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(actionId)
    }
  }

  private async render(
    action: WillAppearEvent<MetricSettings>["action"],
    settings: MetricSettings,
  ): Promise<void> {
    const kind = currentKind(settings)
    const config: MetricConfig = {
      wakatimeApiKey: settings.wakatimeApiKey || process.env.WAKATIME_API_KEY,
      githubToken: settings.githubToken || githubToken(),
      githubLogin: settings.githubLogin || process.env.GITHUB_LOGIN,
      icalUrl: settings.icalUrl || process.env.ICAL_URL,
      includeAllDayMeetings: settings.includeAllDayMeetings,
    }
    try {
      const metric = await fetchMetric(kind, config)
      await action.setTitle(`${metric.label}\n${metric.value}`)
    } catch (error) {
      streamDeck.logger.error(
        `metric ${kind} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      await action.setTitle(`${labelFor(kind)}\n!`)
    }
  }
}

function cycleOf(settings: MetricSettings): readonly MetricKind[] {
  const configured = (settings.cycle ?? []).filter(isMetricKind)
  return configured.length > 0 ? configured : METRIC_KINDS
}

function currentKind(settings: MetricSettings): MetricKind {
  if (isMetricKind(settings.current)) {
    return settings.current
  }
  return cycleOf(settings)[0] ?? "coding"
}

function labelFor(kind: MetricKind): string {
  return LABELS[kind]
}
