import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile, formatNumber } from "../utils/canvas-renderer";

/**
 * Displays daily pageviews (last 24 hours) from Google Analytics
 */
@action({ UUID: "com.samal.test.daily-pageviews" })
export class DailyPageviewsAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("DailyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);

    logger.debug(`Daily Pageviews action appeared (context: ${contextId})`);
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

    logger.debug(`Daily Pageviews action disappeared (context: ${contextId})`);

    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
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
        // Show error state
        for (const [contextId, actionInstance] of this.activeContexts) {
          await actionInstance.setTitle("Error");
          await actionInstance.setImage("");
        }
        return;
      }

      // Render custom tile with canvas
      const imageData = await renderTile({
        title: "Daily Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: "#0f3460", // Navy blue background
        textColor: "#ffffff",
      });

      // Update all visible instances with the rendered image
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setImage(imageData);
        await actionInstance.setTitle("");
      }

      logger.debug(`Daily Pageviews updated: ${formatNumber(value)} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Daily Pageviews:", error);
      
      // Show error on all instances
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setTitle("Error");
        await actionInstance.setImage("");
      }
    }
  }

  private async updateMetric(action: any): Promise<void> {
    try {
      const { value, change } = await this.analyticsService.getDailyPageviewsWithChange();
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      const imageData = await renderTile({
        title: "Daily Views",
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: "#0f3460",
        textColor: "#ffffff",
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

