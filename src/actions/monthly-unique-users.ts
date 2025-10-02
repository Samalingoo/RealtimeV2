import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";
import { renderTile, formatNumber } from "../utils/canvas-renderer";

interface MonthlyUniqueUsersSettings {
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
  showingPrevious?: boolean;
}

/**
 * Displays monthly unique users (last 30 days) from Google Analytics
 */
@action({ UUID: "com.samal.test.monthly-unique-users" })
export class MonthlyUniqueUsersAction extends SingletonAction<MonthlyUniqueUsersSettings> {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Map<string, any>();
  private settingsCache = new Map<string, MonthlyUniqueUsersSettings>();
  private lastValue?: number;
  private lastChange?: number;
  private lastPreviousValue?: number;
  private lastPreviousChange?: number;

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("MonthlyUniqueUsersAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent<MonthlyUniqueUsersSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.set(contextId, ev.action);
    this.settingsCache.set(contextId, ev.payload.settings);

    logger.debug(`Monthly Unique Users action appeared (context: ${contextId})`);
    await ev.action.setTitle("Loading...");

    if (this.activeContexts.size === 1) {
      this.startPolling();
    } else if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MonthlyUniqueUsersSettings>): Promise<void> {
    const contextId = ev.action.id;
    this.settingsCache.set(contextId, ev.payload.settings);
    logger.debug(`Monthly Unique Users settings updated for context ${contextId}`);
    if (this.lastValue !== undefined && this.lastChange !== undefined) {
      await this.updateMetric(ev.action, ev.payload.settings);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    const contextId = ev.action.id;
    this.activeContexts.delete(contextId);
    this.settingsCache.delete(contextId);

    logger.debug(`Monthly Unique Users action disappeared (context: ${contextId})`);

    if (this.activeContexts.size === 0) {
      this.stopPolling();
      this.lastValue = undefined;
      this.lastChange = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<MonthlyUniqueUsersSettings>): Promise<void> {
    logger.debug("Monthly Unique Users action pressed - toggling period");
    
    const contextId = ev.action.id;
    const currentSettings = this.settingsCache.get(contextId) || {};
    
    // Toggle the showingPrevious flag
    const showingPrevious = !currentSettings.showingPrevious;
    const updatedSettings = { ...currentSettings, showingPrevious };
    
    // Save the updated settings
    this.settingsCache.set(contextId, updatedSettings);
    await ev.action.setSettings(updatedSettings);
    
    // Update the display immediately
    await this.updateMetric(ev.action, updatedSettings);
  }

  private startPolling(): void {
    const config = loadConfig();
    logger.info(`Starting Monthly Unique Users polling (interval: ${config.pollIntervalMs}ms)`);

    this.updateAllInstances();
    this.pollInterval = setInterval(() => {
      this.updateAllInstances();
    }, config.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info("Monthly Unique Users polling stopped");
    }
  }

  private async updateAllInstances(): Promise<void> {
    logger.debug(`Updating ${this.activeContexts.size} Monthly Unique Users instance(s)`);

    try {
      // Fetch both current and previous period data
      const [currentData, previousData] = await Promise.all([
        this.analyticsService.getMonthlyUniqueUsersWithChange(),
        this.analyticsService.getPreviousMonthlyUniqueUsersWithChange()
      ]);
      
      if (currentData.value === -1) {
        for (const [contextId, actionInstance] of this.activeContexts) {
          const imageData = await renderTile({
            title: "Monthly Users",
            value: "Error",
            backgroundColor: "#16213e",
            textColor: "#ffffff",
          });
          await actionInstance.setImage(imageData);
          await actionInstance.setTitle("");
        }
        return;
      }

      this.lastValue = currentData.value;
      this.lastChange = currentData.change;
      this.lastPreviousValue = previousData.value;
      this.lastPreviousChange = previousData.change;

      for (const [contextId, actionInstance] of this.activeContexts) {
        const settings = this.settingsCache.get(contextId) || {};
        await this.updateMetric(actionInstance, settings);
      }

      logger.debug(`Monthly Unique Users updated: ${formatNumber(currentData.value)} (${currentData.change >= 0 ? "+" : ""}${currentData.change.toFixed(1)}%)`);
    } catch (error) {
      logger.error("Error updating Monthly Unique Users:", error);
      for (const [contextId, actionInstance] of this.activeContexts) {
        const imageData = await renderTile({
          title: "Monthly Users",
          value: "Error",
          backgroundColor: "#16213e",
          textColor: "#ffffff",
        });
        await actionInstance.setImage(imageData);
        await actionInstance.setTitle("");
      }
    }
  }

  private async updateMetric(action: any, settings?: MonthlyUniqueUsersSettings): Promise<void> {
    try {
      const showingPrevious = settings?.showingPrevious || false;
      let value: number;
      let change: number;

      if (showingPrevious) {
        // Use cached previous period data or fetch if not available
        if (this.lastPreviousValue !== undefined && this.lastPreviousChange !== undefined) {
          value = this.lastPreviousValue;
          change = this.lastPreviousChange;
        } else {
          const result = await this.analyticsService.getPreviousMonthlyUniqueUsersWithChange();
          value = result.value;
          change = result.change;
        }
      } else {
        // Use cached current period data or fetch if not available
        if (this.lastValue !== undefined && this.lastChange !== undefined) {
          value = this.lastValue;
          change = this.lastChange;
        } else {
          const result = await this.analyticsService.getMonthlyUniqueUsersWithChange();
          value = result.value;
          change = result.change;
        }
      }
      
      if (value === -1) {
        const imageData = await renderTile({
          title: settings?.customTitle || "Monthly Users",
          value: "Error",
          backgroundColor: settings?.backgroundColor || "#16213e",
          textColor: settings?.textColor || "#ffffff",
        });
        await action.setImage(imageData);
        await action.setTitle("");
        return;
      }

      // Update the title to reflect which period is shown
      const baseTitle = settings?.customTitle || "Monthly Users";
      const displayTitle = showingPrevious ? `${baseTitle} (Prev)` : baseTitle;

      const imageData = await renderTile({
        title: displayTitle,
        value: formatNumber(value),
        percentageChange: change,
        backgroundColor: settings?.backgroundColor || "#16213e",
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
      logger.error("Error updating Monthly Unique Users metric:", error);
      const imageData = await renderTile({
        title: settings?.customTitle || "Monthly Users",
        value: "Error",
        backgroundColor: settings?.backgroundColor || "#16213e",
        textColor: settings?.textColor || "#ffffff",
      });
      await action.setImage(imageData);
      await action.setTitle("");
    }
  }
}


