import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile, formatNumber } from "../utils/canvas-renderer";

interface WeeklyPageviewsSettings {
  customTitle?: string;
  titleSize?: number;
  valueSize?: number;
  percentageSize?: number;
  titleY?: number;
  valueY?: number;
  percentageY?: number;
  backgroundColor?: string;
  textColor?: string;
  positiveColor?: string;
  negativeColor?: string;
}

/**
 * Displays weekly pageviews (last 7 days) from Google Analytics
 */
@action({ UUID: "com.samal.test.weekly-pageviews" })
export class WeeklyPageviewsAction extends SingletonAction<WeeklyPageviewsSettings> {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();
  private settingsCache = new Map<string, WeeklyPageviewsSettings>();
  private lastValue?: number;
  private lastChange?: number;

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("WeeklyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent<WeeklyPageviewsSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);
    this.settingsCache.set(contextId, ev.payload.settings);

    logger.debug(`Weekly Pageviews action appeared (context: ${contextId})`);
    await ev.action.setTitle("Loading...");

    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WeeklyPageviewsSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.settingsCache.set(contextId, ev.payload.settings);
    logger.debug(`Weekly Pageviews settings updated for context ${contextId}`);
    if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);
    this.settingsCache.delete(contextId);

    logger.debug(`Weekly Pageviews action disappeared (context: ${contextId})`);

    if (this.activeContexts.size === 0) {
      this.stopPolling();
      this.lastValue = undefined;
      this.lastChange = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<WeeklyPageviewsSettings>): Promise<void> {
    logger.debug("Weekly Pageviews action pressed - manual refresh");
    await ev.action.setTitle("Updating...");
    await this.updateMetric(ev.action);
  }

  private startPolling(): void {
    const config = loadConfig();
    logger.info(`Starting Weekly Pageviews polling (interval: ${config.pollIntervalMs}ms)`);

    this.updateAllInstances();
    this.pollInterval = setInterval(() => {
      this.updateAllInstances();
    }, config.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info("Weekly Pageviews polling stopped");
    }
  }

  private async updateAllInstances(): Promise<void> {
    logger.debug(`Updating ${this.activeContexts.size} Weekly Pageviews instance(s)`);

    try {
      const { value, change } = await this.analyticsService.getWeeklyPageviewsWithChange();
      
      if (value === -1) {
        for (const [contextId, actionInstance] of this.activeContexts) {
          await actionInstance.setTitle("Error");
          await actionInstance.setImage("");
        }
        return;
      }

      this.lastValue = value;
      this.lastChange = change;

      for (const [contextId, actionInstance] of this.activeContexts) {
        const settings = this.settingsCache.get(contextId) || {};
        await this.updateMetric(actionInstance, settings, value, change);
      }

      logger.debug(`Weekly Pageviews updated: ${formatNumber(value)} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Weekly Pageviews:", error);
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setTitle("Error");
        await actionInstance.setImage("");
      }
    }
  }

  private async updateMetric(action: any, settings?: WeeklyPageviewsSettings, value?: number, change?: number): Promise<void> {
    try {
      if (value === undefined || change === undefined) {
        const result = await this.analyticsService.getWeeklyPageviewsWithChange();
        value = result.value;
        change = result.change;
      }
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      const imageData = await renderTile({
        title: settings?.customTitle || "Weekly Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: settings?.backgroundColor || "#2d3436",
        textColor: settings?.textColor || "#dfe6e9",
        titleSize: settings?.titleSize || 14,
        valueSize: settings?.valueSize || 36,
        percentageSize: settings?.percentageSize || 16,
        titleY: settings?.titleY || 20,
        valueY: settings?.valueY || 72,
        percentageY: settings?.percentageY || 124,
      });

      await action.setImage(imageData);
      await action.setTitle("");
    } catch (error) {
      logger.error("Error updating Weekly Pageviews metric:", error);
      await action.setTitle("Error");
      await action.setImage("");
    }
  }
}


