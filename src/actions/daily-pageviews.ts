import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile, formatNumber } from "../utils/canvas-renderer";

interface DailyPageviewsSettings {
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
 * Displays daily pageviews (last 24 hours) from Google Analytics
 */
@action({ UUID: "com.samal.test.daily-pageviews" })
export class DailyPageviewsAction extends SingletonAction<DailyPageviewsSettings> {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();
  private settingsCache = new Map<string, DailyPageviewsSettings>();
  private lastValue?: number;
  private lastChange?: number;

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("DailyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent<DailyPageviewsSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);
    this.settingsCache.set(contextId, ev.payload.settings);

    logger.debug(`Daily Pageviews action appeared (context: ${contextId})`);
    await ev.action.setTitle("Loading...");

    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DailyPageviewsSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.settingsCache.set(contextId, ev.payload.settings);
    logger.debug(`Daily Pageviews settings updated for context ${contextId}`);
    if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);
    this.settingsCache.delete(contextId);

    logger.debug(`Daily Pageviews action disappeared (context: ${contextId})`);

    if (this.activeContexts.size === 0) {
      this.stopPolling();
      this.lastValue = undefined;
      this.lastChange = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<DailyPageviewsSettings>): Promise<void> {
    logger.debug("Daily Pageviews action pressed - manual refresh");
    await ev.action.setTitle("Updating...");
    await this.updateMetric(ev.action);
  }

  private startPolling(): void {
    const config = loadConfig();
    logger.info(`Starting Daily Pageviews polling (interval: ${config.pollIntervalMs}ms)`);

    this.updateAllInstances();
    this.pollInterval = setInterval(() => {
      this.updateAllInstances();
    }, config.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info("Daily Pageviews polling stopped");
    }
  }

  private async updateAllInstances(): Promise<void> {
    logger.debug(`Updating ${this.activeContexts.size} Daily Pageviews instance(s)`);

    try {
      const { value, change } = await this.analyticsService.getDailyPageviewsWithChange();
      
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

      logger.debug(`Daily Pageviews updated: ${formatNumber(value)} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Daily Pageviews:", error);
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setTitle("Error");
        await actionInstance.setImage("");
      }
    }
  }

  private async updateMetric(action: any, settings?: DailyPageviewsSettings, value?: number, change?: number): Promise<void> {
    try {
      if (value === undefined || change === undefined) {
        const result = await this.analyticsService.getDailyPageviewsWithChange();
        value = result.value;
        change = result.change;
      }
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      const imageData = await renderTile({
        title: settings?.customTitle || "Daily Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: settings?.backgroundColor || "#0f3460",
        textColor: settings?.textColor || "#ffffff",
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
      logger.error("Error updating Daily Pageviews metric:", error);
      await action.setTitle("Error");
      await action.setImage("");
    }
  }
}


