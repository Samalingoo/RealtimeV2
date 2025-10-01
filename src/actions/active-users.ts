import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile } from "../utils/canvas-renderer";

interface ActiveUsersSettings {
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
 * Displays real-time active users from Google Analytics
 */
@action({ UUID: "com.samal.test.active-users" })
export class ActiveUsersAction extends SingletonAction<ActiveUsersSettings> {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();
  private settingsCache = new Map<string, ActiveUsersSettings>();
  private lastValue?: number;
  private lastChange?: number;

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("ActiveUsersAction initialized");
  }

  /**
   * Called when action appears on Stream Deck
   */
  override async onWillAppear(ev: WillAppearEvent<ActiveUsersSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);
    this.settingsCache.set(contextId, ev.payload.settings);

    logger.debug(`Active Users action appeared (context: ${contextId})`);

    // Set initial loading state
    await ev.action.setTitle("Loading...");

    // Start polling if this is the first instance
    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else {
      // Immediately update this instance with cached data
      if (this.lastValue !== undefined && this.lastChange !== undefined) {
        await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
      }
    }
  }

  /**
   * Called when settings are received/changed
   */
  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ActiveUsersSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.settingsCache.set(contextId, ev.payload.settings);
    
    logger.debug(`Active Users settings updated for context ${contextId}`);
    
    // Immediately re-render with new settings
    if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings, this.lastValue, this.lastChange);
    }
  }

  /**
   * Called when action disappears from Stream Deck
   */
  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);
    this.settingsCache.delete(contextId);

    logger.debug(`Active Users action disappeared (context: ${contextId})`);

    // Stop polling if no instances are visible
    if (this.activeContexts.size === 0) {
      this.stopPolling();
      this.lastValue = undefined;
      this.lastChange = undefined;
    }
  }

  /**
   * Handle key press (manual refresh)
   */
  override async onKeyDown(ev: KeyDownEvent<ActiveUsersSettings>): Promise<void> {
    logger.debug("Active Users action pressed - manual refresh");
    await ev.action.setTitle("Updating...");
    await this.updateMetric(ev.action, ev.payload.settings);
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

      // Cache the latest values
      this.lastValue = value;
      this.lastChange = change;

      // Update all visible instances using cached settings
      for (const [contextId, actionInstance] of this.activeContexts) {
        const settings = this.settingsCache.get(contextId) || {};
        await this.updateMetric(actionInstance, settings, value, change);
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
  private async updateMetric(action: any, settings?: ActiveUsersSettings, value?: number, change?: number): Promise<void> {
    try {
      // Fetch data if not provided
      if (value === undefined || change === undefined) {
        const result = await this.analyticsService.getActiveUsersWithChange();
        value = result.value;
        change = result.change;
      }
      
      if (value === -1) {
        await action.setTitle("Error");
        await action.setImage("");
        return;
      }

      // Apply settings with defaults
      const imageData = await renderTile({
        title: settings?.customTitle || "Active Users",
        value: value.toString(),
        percentageChange: change,
        backgroundColor: settings?.backgroundColor || "#1a1a2e",
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
      logger.error("Error updating Active Users metric:", error);
      await action.setTitle("Error");
      await action.setImage("");
    }
  }
}

