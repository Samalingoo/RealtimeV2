import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile, formatNumber } from "../utils/canvas-renderer";

/**
 * Displays weekly pageviews (last 7 days) from Google Analytics
 */
@action({ UUID: "com.samal.test.weekly-pageviews" })
export class WeeklyPageviewsAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("WeeklyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);

    logger.debug(`Weekly Pageviews action appeared (context: ${contextId})`);
    await ev.action.setTitle("Loading...");

    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else {
      await this.updateMetric(ev.action);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);

    logger.debug(`Weekly Pageviews action disappeared (context: ${contextId})`);

    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
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
        // Show error state
        for (const [contextId, actionInstance] of this.activeContexts) {
          await actionInstance.setTitle("Error");
          await actionInstance.setImage("");
        }
        return;
      }

      // Render custom tile with canvas
      const imageData = await renderTile({
        title: "Weekly Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: "#2d3436", // Modern dark background
        textColor: "#dfe6e9",
      });

      // Update all visible instances with the rendered image
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setImage(imageData);
        await actionInstance.setTitle("");
      }

      logger.debug(`Weekly Pageviews updated: ${formatNumber(value)} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Weekly Pageviews:", error);
      
      // Show error on all instances
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setTitle("Error");
        await actionInstance.setImage("");
      }
    }
  }

  private async updateMetric(action: any): Promise<void> {
    try {
      const { value, change } = await this.analyticsService.getWeeklyPageviewsWithChange();
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      const imageData = await renderTile({
        title: "Weekly Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: "#2d3436",
        textColor: "#dfe6e9",
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

