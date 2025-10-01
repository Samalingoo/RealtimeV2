import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile } from "../utils/canvas-renderer";

/**
 * Displays real-time active users from Google Analytics
 */
@action({ UUID: "com.samal.test.active-users" })
export class ActiveUsersAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("ActiveUsersAction initialized");
  }

  /**
   * Called when action appears on Stream Deck
   */
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);

    logger.debug(`Active Users action appeared (context: ${contextId})`);

    // Set initial loading state
    await ev.action.setTitle("Loading...");

    // Start polling if this is the first instance
    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else {
      // Immediately update this instance
      await this.updateMetric(ev.action);
    }
  }

  /**
   * Called when action disappears from Stream Deck
   */
  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);

    logger.debug(`Active Users action disappeared (context: ${contextId})`);

    // Stop polling if no instances are visible
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Handle key press (manual refresh)
   */
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    logger.debug("Active Users action pressed - manual refresh");
    await ev.action.setTitle("Updating...");
    await this.updateMetric(ev.action);
  }

  /**
   * Start polling for updates
   */
  private startPolling(): void {
    const config = loadConfig();
    
    logger.info(`Starting Active Users polling (interval: ${config.pollIntervalMs}ms)`);

    // Immediate first update
    this.updateAllInstances();

    // Set up recurring updates
    this.pollInterval = setInterval(() => {
      this.updateAllInstances();
    }, config.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info("Active Users polling stopped");
    }
  }

  /**
   * Update all visible instances
   */
  private async updateAllInstances(): Promise<void> {
    logger.debug(`Updating ${this.activeContexts.size} Active Users instance(s)`);

    try {
      const { value, change } = await this.analyticsService.getActiveUsersWithChange();
      
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
        title: "Active Users",
        value: value.toString(),
        percentageChange: change,
        backgroundColor: "#1a1a2e", // Dark blue background
        textColor: "#ffffff",
      });

      // Update all visible instances with the rendered image
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setImage(imageData);
        // Clear title since we're rendering it in the canvas
        await actionInstance.setTitle("");
      }

      logger.debug(`Active Users updated: ${value} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Active Users:", error);
      
      // Show error on all instances
      for (const [contextId, actionInstance] of this.activeContexts) {
        await actionInstance.setTitle("Error");
        await actionInstance.setImage("");
      }
    }
  }

  /**
   * Update a specific action instance
   */
  private async updateMetric(action: any): Promise<void> {
    try {
      const { value, change } = await this.analyticsService.getActiveUsersWithChange();
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      const imageData = await renderTile({
        title: "Active Users",
        value: value.toString(),
        percentageChange: change,
        backgroundColor: "#1a1a2e",
        textColor: "#ffffff",
      });

      await action.setImage(imageData);
      await action.setTitle("");
    } catch (error) {
      logger.error("Error updating Active Users metric:", error);
      await action.setTitle("Error");
      await action.setImage("");
    }
  }
}

