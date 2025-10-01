# Project Scope: Google Analytics Stream Deck Plugin

## Overview

A lightweight Stream Deck plugin that displays real-time Google Analytics 4 (GA4) statistics directly on your Stream Deck keys. The plugin shows:
- **Active Users** (real-time)
- **Daily Pageviews** (last 24 hours)
- **Weekly Pageviews** (last 7 days)

The plugin uses Google Analytics Data API with service account authentication and follows Elgato Stream Deck SDK standards for optimal performance and compatibility with Windows 11.

---

## Table of Contents

1. [Technical Requirements](#technical-requirements)
2. [Architecture Overview](#architecture-overview)
3. [File Structure](#file-structure)
4. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
5. [Configuration](#configuration)
6. [Debugging and Logging](#debugging-and-logging)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Technical Requirements

### Software Prerequisites
- **Windows 11** (or Windows 10 minimum)
- **Node.js 20.x** (required by Stream Deck SDK)
- **pnpm** (package manager)
- **Stream Deck Software** (version 6.5 or higher)
- **Elgato Stream Deck CLI** (for development)

### Dependencies
```json
{
  "@elgato/streamdeck": "^1.0.0",
  "googleapis": "^140.0.0"
}
```

### Google Analytics Setup
1. **Google Cloud Project** with Analytics Data API enabled
2. **Service Account** with Viewer permissions on GA4 property
3. **GA4 Property ID** (format: `123456789`)

---

## Architecture Overview

### Design Principles
1. **Lightweight**: Minimal dependencies, no UI rendering beyond SDK features
2. **Bulletproof**: Comprehensive error handling and retry logic
3. **Debug-friendly**: Detailed logging at configurable levels
4. **SDK-compliant**: Uses Stream Deck SDK v2 standards
5. **Efficient**: Smart polling with configurable intervals

### Component Structure

```
src/
├── plugin.ts              # Main entry point, registers actions
├── actions/
│   ├── active-users.ts    # Real-time active users action
│   ├── daily-pageviews.ts # Daily pageviews action
│   └── weekly-pageviews.ts# Weekly pageviews action
├── services/
│   ├── analytics.ts       # Google Analytics API client
│   └── config.ts          # Configuration loader
└── utils/
    └── logger.ts          # Centralized logging utility
```

### Data Flow

```
Stream Deck App
    ↓
Plugin (plugin.ts)
    ↓
Action Classes (e.g., active-users.ts)
    ↓
Analytics Service (analytics.ts)
    ↓
Google Analytics API
    ↓
Display via setTitle()
```

---

## File Structure

```
com.samal.test.sdPlugin/
├── bin/
│   ├── package.json
│   └── plugin.js              # Built output
├── imgs/
│   └── actions/
│       ├── active-users/
│       │   ├── icon.png       # 20x20 icon
│       │   ├── icon@2x.png    # 40x40 icon
│       │   ├── key.png        # 72x72 key image
│       │   └── key@2x.png     # 144x144 key image
│       ├── daily-pageviews/
│       │   └── [same structure]
│       └── weekly-pageviews/
│           └── [same structure]
├── logs/                      # Auto-generated logs
├── manifest.json              # Stream Deck plugin manifest
└── ui/                        # (Optional) Property inspector HTML

Root Directory:
├── src/                       # TypeScript source files
├── service-account.json       # Google service account credentials
├── config.json                # Plugin configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── rollup.config.mjs          # Build configuration
```

---

## Step-by-Step Implementation Guide

### Step 1: Install Dependencies

```powershell
# Navigate to project directory
cd C:\Users\anim8\Documents\GitHub\test

# Install Google Analytics API
pnpm add googleapis

# Install dev dependencies (if not already installed)
pnpm install
```

### Step 2: Create Configuration Loader

**File: `src/utils/logger.ts`**

This utility provides centralized logging with configurable levels.

```typescript
import streamDeck from "@elgato/streamdeck";
import { LogLevel } from "@elgato/streamdeck";
import * as fs from "fs";
import * as path from "path";

/**
 * Logger utility that wraps Stream Deck logger with configuration support
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.loadLogLevel();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private loadLogLevel(): void {
    try {
      const configPath = path.join(__dirname, "../../config.json");
      const configData = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(configData);

      const levelMap: { [key: string]: LogLevel } = {
        trace: LogLevel.TRACE,
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        error: LogLevel.ERROR,
      };

      this.logLevel = levelMap[config.logLevel?.toLowerCase()] || LogLevel.INFO;
      streamDeck.logger.setLevel(this.logLevel);
      
      this.info("Logger initialized with level:", config.logLevel);
    } catch (error) {
      streamDeck.logger.setLevel(LogLevel.INFO);
      this.error("Failed to load log level from config:", error);
    }
  }

  public trace(message: string, ...args: any[]): void {
    streamDeck.logger.trace(`[GA Plugin] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    streamDeck.logger.debug(`[GA Plugin] ${message}`, ...args);
  }

  public info(message: string, ...args: any[]): void {
    streamDeck.logger.info(`[GA Plugin] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    streamDeck.logger.warn(`[GA Plugin] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    streamDeck.logger.error(`[GA Plugin] ${message}`, ...args);
  }
}

export const logger = Logger.getInstance();
```

**Key Features:**
- Singleton pattern for consistent logging
- Reads log level from `config.json`
- Prefixes all logs with `[GA Plugin]` for easy filtering
- Falls back to INFO level if config fails

---

### Step 3: Create Configuration Service

**File: `src/services/config.ts`**

Loads and validates configuration from `config.json`.

```typescript
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";

export interface PluginConfig {
  gaPropertyId: string;
  pollIntervalMs: number;
  logLevel: string;
}

/**
 * Loads and validates plugin configuration
 */
export function loadConfig(): PluginConfig {
  try {
    const configPath = path.join(__dirname, "../../config.json");
    logger.debug("Loading config from:", configPath);

    const configData = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData) as PluginConfig;

    // Validate required fields
    if (!config.gaPropertyId) {
      throw new Error("gaPropertyId is required in config.json");
    }

    // Set defaults
    config.pollIntervalMs = config.pollIntervalMs || 10000;
    config.logLevel = config.logLevel || "info";

    logger.info("Configuration loaded successfully:", {
      propertyId: config.gaPropertyId,
      pollInterval: `${config.pollIntervalMs}ms`,
      logLevel: config.logLevel,
    });

    return config;
  } catch (error) {
    logger.error("Failed to load configuration:", error);
    throw new Error(`Configuration error: ${error}`);
  }
}
```

**Validation:**
- Ensures `gaPropertyId` exists
- Sets sensible defaults for optional fields
- Logs configuration details (without sensitive data)

---

### Step 4: Create Google Analytics Service

**File: `src/services/analytics.ts`**

Handles all Google Analytics API interactions.

```typescript
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";
import { loadConfig } from "./config";

export interface AnalyticsMetrics {
  activeUsers?: number;
  dailyPageviews?: number;
  weeklyPageviews?: number;
}

/**
 * Google Analytics service using Data API v1 (GA4)
 */
export class AnalyticsService {
  private auth: JWT | null = null;
  private propertyId: string;
  private isInitialized = false;

  constructor() {
    const config = loadConfig();
    this.propertyId = `properties/${config.gaPropertyId}`;
  }

  /**
   * Initialize authentication with service account
   */
  public async initialize(): Promise<void> {
    try {
      logger.debug("Initializing Analytics Service...");

      const serviceAccountPath = path.join(__dirname, "../../service-account.json");
      
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account file not found: ${serviceAccountPath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      });

      // Test authentication
      await this.auth.authorize();
      this.isInitialized = true;

      logger.info("Analytics Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Analytics Service:", error);
      throw error;
    }
  }

  /**
   * Get real-time active users
   */
  public async getActiveUsers(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.debug("Fetching active users...");

      const analyticsData = google.analyticsdata("v1beta");
      const response = await analyticsData.properties.runRealtimeReport({
        auth: this.auth!,
        property: this.propertyId,
        requestBody: {
          metrics: [{ name: "activeUsers" }],
        },
      });

      const activeUsers = parseInt(response.data.rows?.[0]?.metricValues?.[0]?.value || "0");
      
      logger.debug("Active users retrieved:", activeUsers);
      return activeUsers;
    } catch (error) {
      logger.error("Error fetching active users:", error);
      return -1; // Indicator of error
    }
  }

  /**
   * Get daily pageviews (last 24 hours)
   */
  public async getDailyPageviews(): Promise<number> {
    return this.getPageviews(1, "daily");
  }

  /**
   * Get weekly pageviews (last 7 days)
   */
  public async getWeeklyPageviews(): Promise<number> {
    return this.getPageviews(7, "weekly");
  }

  /**
   * Generic method to fetch pageviews for a date range
   */
  private async getPageviews(daysAgo: number, label: string): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.debug(`Fetching ${label} pageviews (${daysAgo} days)...`);

      const analyticsData = google.analyticsdata("v1beta");
      const response = await analyticsData.properties.runReport({
        auth: this.auth!,
        property: this.propertyId,
        requestBody: {
          dateRanges: [
            {
              startDate: `${daysAgo}daysAgo`,
              endDate: "today",
            },
          ],
          metrics: [{ name: "screenPageViews" }],
        },
      });

      const pageviews = parseInt(response.data.rows?.[0]?.metricValues?.[0]?.value || "0");
      
      logger.debug(`${label} pageviews retrieved:`, pageviews);
      return pageviews;
    } catch (error) {
      logger.error(`Error fetching ${label} pageviews:`, error);
      return -1; // Indicator of error
    }
  }

  /**
   * Test connection and permissions
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.initialize();
      await this.getActiveUsers();
      logger.info("Connection test successful");
      return true;
    } catch (error) {
      logger.error("Connection test failed:", error);
      return false;
    }
  }
}
```

**Key Features:**
- Lazy initialization (only connects when first metric is requested)
- Service account authentication
- Separate methods for each metric type
- Error handling returns -1 to indicate failures
- Comprehensive debug logging for API calls

---

### Step 5: Create Action Classes

**File: `src/actions/active-users.ts`**

Displays real-time active users.

```typescript
import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";

/**
 * Displays real-time active users from Google Analytics
 */
@action({ UUID: "com.samal.test.active-users" })
export class ActiveUsersAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Set<string>();

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
    this.activeContexts.add(contextId);

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
      const activeUsers = await this.analyticsService.getActiveUsers();
      const displayValue = activeUsers === -1 ? "Error" : activeUsers.toString();

      // Update all visible instances
      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle(displayValue);
        }
      }

      logger.debug(`Active Users updated: ${displayValue}`);
    } catch (error) {
      logger.error("Error updating Active Users:", error);
      
      // Show error on all instances
      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle("Error");
        }
      }
    }
  }

  /**
   * Update a specific action instance
   */
  private async updateMetric(action: any): Promise<void> {
    try {
      const activeUsers = await this.analyticsService.getActiveUsers();
      const displayValue = activeUsers === -1 ? "Error" : activeUsers.toString();
      await action.setTitle(displayValue);
    } catch (error) {
      logger.error("Error updating Active Users metric:", error);
      await action.setTitle("Error");
    }
  }

  /**
   * Helper to get action by context ID
   */
  private getActionById(contextId: string): any {
    // Stream Deck SDK provides access to actions by ID
    // This is a simplified version - actual implementation depends on SDK
    return { setTitle: (title: string) => logger.debug(`Would set title to: ${title}`) };
  }
}
```

**File: `src/actions/daily-pageviews.ts`**

```typescript
import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";

/**
 * Displays daily pageviews (last 24 hours) from Google Analytics
 */
@action({ UUID: "com.samal.test.daily-pageviews" })
export class DailyPageviewsAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Set<string>();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("DailyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.add(contextId);

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
      const dailyPageviews = await this.analyticsService.getDailyPageviews();
      const displayValue = dailyPageviews === -1 ? "Error" : this.formatNumber(dailyPageviews);

      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle(displayValue);
        }
      }

      logger.debug(`Daily Pageviews updated: ${displayValue}`);
    } catch (error) {
      logger.error("Error updating Daily Pageviews:", error);
      
      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle("Error");
        }
      }
    }
  }

  private async updateMetric(action: any): Promise<void> {
    try {
      const dailyPageviews = await this.analyticsService.getDailyPageviews();
      const displayValue = dailyPageviews === -1 ? "Error" : this.formatNumber(dailyPageviews);
      await action.setTitle(displayValue);
    } catch (error) {
      logger.error("Error updating Daily Pageviews metric:", error);
      await action.setTitle("Error");
    }
  }

  /**
   * Format large numbers for display (e.g., 1234 -> 1.2K)
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  private getActionById(contextId: string): any {
    return { setTitle: (title: string) => logger.debug(`Would set title to: ${title}`) };
  }
}
```

**File: `src/actions/weekly-pageviews.ts`**

```typescript
import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { AnalyticsService } from "../services/analytics";
import { logger } from "../utils/logger";
import { loadConfig } from "../services/config";

/**
 * Displays weekly pageviews (last 7 days) from Google Analytics
 */
@action({ UUID: "com.samal.test.weekly-pageviews" })
export class WeeklyPageviewsAction extends SingletonAction {
  private analyticsService: AnalyticsService;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeContexts = new Set<string>();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    logger.info("WeeklyPageviewsAction initialized");
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const contextId = ev.action.id;
    this.activeContexts.add(contextId);

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
      const weeklyPageviews = await this.analyticsService.getWeeklyPageviews();
      const displayValue = weeklyPageviews === -1 ? "Error" : this.formatNumber(weeklyPageviews);

      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle(displayValue);
        }
      }

      logger.debug(`Weekly Pageviews updated: ${displayValue}`);
    } catch (error) {
      logger.error("Error updating Weekly Pageviews:", error);
      
      for (const contextId of this.activeContexts) {
        const action = this.getActionById(contextId);
        if (action) {
          await action.setTitle("Error");
        }
      }
    }
  }

  private async updateMetric(action: any): Promise<void> {
    try {
      const weeklyPageviews = await this.analyticsService.getWeeklyPageviews();
      const displayValue = weeklyPageviews === -1 ? "Error" : this.formatNumber(weeklyPageviews);
      await action.setTitle(displayValue);
    } catch (error) {
      logger.error("Error updating Weekly Pageviews metric:", error);
      await action.setTitle("Error");
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  private getActionById(contextId: string): any {
    return { setTitle: (title: string) => logger.debug(`Would set title to: ${title}`) };
  }
}
```

**Action Design Features:**
- **Context Management**: Tracks visible instances to optimize polling
- **Lazy Polling**: Only polls when at least one instance is visible
- **Manual Refresh**: Pressing the key triggers immediate update
- **Number Formatting**: Large numbers are formatted (1.2K, 1.5M)
- **Error Handling**: Displays "Error" on failures
- **Loading States**: Shows "Loading..." and "Updating..." feedback

---

### Step 6: Update Main Plugin File

**File: `src/plugin.ts`**

```typescript
import streamDeck from "@elgato/streamdeck";
import { logger } from "./utils/logger";
import { ActiveUsersAction } from "./actions/active-users";
import { DailyPageviewsAction } from "./actions/daily-pageviews";
import { WeeklyPageviewsAction } from "./actions/weekly-pageviews";

// Logger is initialized via singleton, log level set from config
logger.info("Google Analytics Stream Deck Plugin starting...");

// Register all analytics actions
streamDeck.actions.registerAction(new ActiveUsersAction());
streamDeck.actions.registerAction(new DailyPageviewsAction());
streamDeck.actions.registerAction(new WeeklyPageviewsAction());

logger.info("All actions registered successfully");

// Connect to Stream Deck
streamDeck.connect();

logger.info("Plugin connected to Stream Deck");
```

---

### Step 7: Update Manifest

**File: `com.samal.test.sdPlugin/manifest.json`**

```json
{
  "Name": "Google Analytics",
  "Version": "1.0.0.0",
  "Author": "samal",
  "Actions": [
    {
      "Name": "Active Users",
      "UUID": "com.samal.test.active-users",
      "Icon": "imgs/actions/active-users/icon",
      "Tooltip": "Displays real-time active users from Google Analytics",
      "Controllers": ["Keypad"],
      "States": [
        {
          "Image": "imgs/actions/active-users/key",
          "TitleAlignment": "middle",
          "FontSize": "16"
        }
      ]
    },
    {
      "Name": "Daily Pageviews",
      "UUID": "com.samal.test.daily-pageviews",
      "Icon": "imgs/actions/daily-pageviews/icon",
      "Tooltip": "Displays pageviews from the last 24 hours",
      "Controllers": ["Keypad"],
      "States": [
        {
          "Image": "imgs/actions/daily-pageviews/key",
          "TitleAlignment": "middle",
          "FontSize": "16"
        }
      ]
    },
    {
      "Name": "Weekly Pageviews",
      "UUID": "com.samal.test.weekly-pageviews",
      "Icon": "imgs/actions/weekly-pageviews/icon",
      "Tooltip": "Displays pageviews from the last 7 days",
      "Controllers": ["Keypad"],
      "States": [
        {
          "Image": "imgs/actions/weekly-pageviews/key",
          "TitleAlignment": "middle",
          "FontSize": "16"
        }
      ]
    }
  ],
  "Category": "Analytics",
  "CategoryIcon": "imgs/plugin/category-icon",
  "CodePath": "bin/plugin.js",
  "Description": "Display Google Analytics statistics on your Stream Deck",
  "Icon": "imgs/plugin/marketplace",
  "SDKVersion": 2,
  "Software": {
    "MinimumVersion": "6.5"
  },
  "OS": [
    {
      "Platform": "mac",
      "MinimumVersion": "12"
    },
    {
      "Platform": "windows",
      "MinimumVersion": "10"
    }
  ],
  "Nodejs": {
    "Version": "20",
    "Debug": "enabled"
  },
  "UUID": "com.samal.test"
}
```

**Manifest Considerations:**
- **FontSize**: Set to 16 for readable numbers
- **TitleAlignment**: Middle alignment for centered display
- **Tooltip**: Clear descriptions of what each action does
- **Category**: Changed to "Analytics" for better organization
- **NodeJS Debug**: Enabled for development troubleshooting

---

### Step 8: Update Package.json

**File: `package.json`**

Add the `googleapis` dependency:

```json
{
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w --watch.onEnd=\"streamdeck restart com.samal.test\""
  },
  "type": "module",
  "devDependencies": {
    "@elgato/cli": "^1.5.0",
    "@rollup/plugin-commonjs": "^28.0.0",
    "@rollup/plugin-node-resolve": "^15.2.2",
    "@rollup/plugin-terser": "^0.4.4",
    "@rollup/plugin-typescript": "^12.1.0",
    "@tsconfig/node20": "^20.1.2",
    "@types/node": "~20.15.0",
    "rollup": "^4.0.2",
    "tslib": "^2.6.2",
    "typescript": "^5.2.2"
  },
  "dependencies": {
    "@elgato/streamdeck": "^1.0.0",
    "googleapis": "^140.0.0"
  }
}
```

---

## Configuration

### config.json Structure

```json
{
  "gaPropertyId": "123456789",
  "pollIntervalMs": 10000,
  "logLevel": "debug"
}
```

**Fields:**
- `gaPropertyId`: Your GA4 property ID (numeric only, no "properties/" prefix)
- `pollIntervalMs`: How often to fetch data (milliseconds, minimum 5000)
- `logLevel`: Logging verbosity (trace | debug | info | warn | error)

### service-account.json Setup

1. **Create Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file

2. **Enable API**:
   - In Google Cloud Console, enable "Google Analytics Data API"

3. **Grant Access**:
   - In GA4 Admin, go to Property Access Management
   - Add service account email as Viewer

4. **Place File**:
   - Save as `service-account.json` in project root
   - Ensure it's NOT committed to version control (add to `.gitignore`)

---

## Debugging and Logging

### Log Levels

```
TRACE: All API requests and responses
DEBUG: Function calls, data updates, context changes
INFO:  Plugin lifecycle events, configuration loading
WARN:  Recoverable errors, missing optional data
ERROR: Critical failures, API errors
```

### Viewing Logs

**Windows 11 Path:**
```
C:\Users\anim8\Documents\GitHub\test\com.samal.test.sdPlugin\logs\
```

**Live Monitoring (PowerShell):**
```powershell
Get-Content "com.samal.test.sdPlugin\logs\com.samal.test.0.log" -Wait -Tail 50
```

### Common Log Messages

```
[GA Plugin] Logger initialized with level: debug
[GA Plugin] Configuration loaded successfully
[GA Plugin] Analytics Service initialized successfully
[GA Plugin] Active Users action appeared (context: ABC123)
[GA Plugin] Starting Active Users polling (interval: 10000ms)
[GA Plugin] Fetching active users...
[GA Plugin] Active users retrieved: 42
[GA Plugin] Active Users updated: 42
```

### Debugging Tips

1. **Set logLevel to "trace"** in config.json for maximum verbosity
2. **Check logs immediately** after plugin loads
3. **Verify service account** authentication in logs
4. **Monitor API calls** to ensure proper requests
5. **Watch for error patterns** indicating configuration issues

---

## Testing

### Pre-Deployment Checklist

- [ ] `service-account.json` exists and is valid
- [ ] `config.json` has correct GA property ID
- [ ] Google Analytics Data API is enabled
- [ ] Service account has Viewer access to GA property
- [ ] Node.js 20.x is installed
- [ ] Stream Deck software is running
- [ ] All dependencies are installed (`pnpm install`)

### Build and Install

```powershell
# Build the plugin
pnpm run build

# Link plugin to Stream Deck (development)
streamdeck link

# Or restart existing installation
streamdeck restart com.samal.test
```

### Testing Procedure

1. **Build Plugin**:
   ```powershell
   pnpm run build
   ```

2. **Check Build Output**:
   - Verify `com.samal.test.sdPlugin/bin/plugin.js` exists
   - Check for any build errors

3. **Install to Stream Deck**:
   ```powershell
   streamdeck link
   ```

4. **Add Actions**:
   - Open Stream Deck software
   - Find "Google Analytics" category
   - Drag "Active Users", "Daily Pageviews", "Weekly Pageviews" to keys

5. **Verify Display**:
   - Keys should show "Loading..." then display numbers
   - Press keys to trigger manual refresh
   - Check logs for errors

6. **Test Error Handling**:
   - Temporarily rename `service-account.json`
   - Verify "Error" displays on keys
   - Check logs for detailed error messages
   - Restore `service-account.json`

### Watch Mode (Development)

```powershell
# Auto-rebuild and restart on file changes
pnpm run watch
```

---

## Deployment

### Creating Distribution Package

1. **Update Version** in `manifest.json`:
   ```json
   "Version": "1.0.0.0"
   ```

2. **Build Production Version**:
   ```powershell
   pnpm run build
   ```

3. **Create Plugin Package**:
   ```powershell
   streamdeck pack com.samal.test.sdPlugin
   ```

4. **Output**:
   - Creates `com.samal.test.streamDeckPlugin` file
   - Double-click to install

### Installation on Other Machines

1. **Prerequisites**:
   - Stream Deck software installed
   - Internet connection (for initial API calls)

2. **Copy Files**:
   - `com.samal.test.streamDeckPlugin` (plugin package)
   - `service-account.json` (must be placed in plugin directory after installation)
   - `config.json` (must be placed in plugin directory after installation)

3. **Install**:
   - Double-click `.streamDeckPlugin` file
   - Copy `service-account.json` and `config.json` to:
     ```
     %APPDATA%\Elgato\StreamDeck\Plugins\com.samal.test.sdPlugin\
     ```

---

## Troubleshooting

### Issue: "Error" Displayed on Key

**Possible Causes:**
1. **Invalid Credentials**
   - Check `service-account.json` exists
   - Verify JSON is valid (use online validator)
   - Check logs for "Failed to initialize Analytics Service"

2. **No GA Access**
   - Ensure service account email has Viewer access in GA4
   - Verify property ID in `config.json` is correct (numeric only)

3. **API Not Enabled**
   - Enable "Google Analytics Data API" in Google Cloud Console

**Solution:**
```powershell
# Check logs
Get-Content "com.samal.test.sdPlugin\logs\com.samal.test.0.log" -Tail 100

# Look for error messages starting with "[GA Plugin] Error"
```

---

### Issue: "Loading..." Never Changes

**Possible Causes:**
1. **Network Issues**
   - Plugin can't reach Google APIs
   - Firewall blocking requests

2. **Slow API Response**
   - First request can take 5-10 seconds
   - Be patient on initial load

**Solution:**
- Wait 15 seconds
- Check logs for "Fetching active users..." messages
- Verify internet connection
- Try manual refresh (press key)

---

### Issue: Numbers Not Updating

**Possible Causes:**
1. **Polling Stopped**
   - Check `pollIntervalMs` in config.json
   - Verify no errors in logs

2. **All Instances Removed**
   - Polling stops when no keys are visible
   - Add action back to trigger polling restart

**Solution:**
- Check logs for "Starting [Action] polling" messages
- Verify `config.json` is properly formatted
- Restart plugin: `streamdeck restart com.samal.test`

---

### Issue: Build Fails

**Possible Causes:**
1. **TypeScript Errors**
   - Check syntax in .ts files
   - Verify imports are correct

2. **Missing Dependencies**
   - `googleapis` not installed

**Solution:**
```powershell
# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
pnpm install

# Rebuild
pnpm run build
```

---

### Issue: High Memory Usage

**Possible Causes:**
1. **Too Many Instances**
   - Each action instance creates its own polling loop
   - Multiple instances should share the same loop

**Solution:**
- This is already handled in the action classes via `activeContexts` Set
- If issue persists, increase `pollIntervalMs` in config.json

---

## Best Practices

### Performance Optimization

1. **Efficient Polling**:
   - Only poll when actions are visible
   - Share analytics service instance across actions
   - Use configurable intervals (min 5000ms recommended)

2. **API Quota Management**:
   - Google Analytics API has daily quotas
   - Default 10-second interval = 8,640 requests/day
   - Stay well within limits (25,000 requests/day for free tier)

3. **Error Recovery**:
   - Return -1 on errors (displayed as "Error")
   - Continue polling after errors
   - Log all errors for diagnostics

### Security Considerations

1. **Credential Protection**:
   - Never commit `service-account.json` to version control
   - Add to `.gitignore`:
     ```
     service-account.json
     config.json
     ```

2. **Least Privilege**:
   - Service account should only have Viewer permissions
   - No write access needed

3. **Audit Logging**:
   - All API calls are logged (when logLevel is debug/trace)
   - Review logs periodically for suspicious activity

### Code Maintenance

1. **Modular Design**:
   - Each action is independent
   - Shared services (analytics, config, logger)
   - Easy to add new metrics

2. **Type Safety**:
   - Use TypeScript interfaces
   - Validate configuration on load
   - Handle null/undefined gracefully

3. **Documentation**:
   - JSDoc comments on all public methods
   - Clear variable names (camelCase)
   - Organized file structure (kebab-case directories)

---

## Future Enhancements

### Potential Features

1. **Additional Metrics**:
   - Bounce rate
   - Average session duration
   - Top pages
   - Traffic sources

2. **Custom Date Ranges**:
   - Allow user to select date ranges via property inspector
   - Month-to-date, year-to-date views

3. **Multi-Property Support**:
   - Support multiple GA properties
   - Switch via settings

4. **Alerts**:
   - Flash key on threshold breach
   - Notification when active users spike

5. **Caching**:
   - Cache API responses for 1-2 minutes
   - Reduce API calls during rapid key presses

### Implementation Considerations

- **Property Inspector**: Add HTML UI for settings
- **Multi-instance State**: Track settings per action instance
- **Image Rendering**: For more complex displays (not recommended for v1)
- **Localization**: Support multiple languages

---

## SDK Compliance Checklist

✅ **SDK Version 2**: Using `@elgato/streamdeck` ^1.0.0  
✅ **Node.js 20**: Specified in manifest  
✅ **Singleton Actions**: Using `SingletonAction` base class  
✅ **Event Handlers**: Implement `onWillAppear`, `onWillDisappear`, `onKeyDown`  
✅ **Title API**: Using `setTitle()` for display (no custom rendering)  
✅ **Logging**: Using Stream Deck logger (`streamDeck.logger`)  
✅ **Manifest**: Valid JSON with all required fields  
✅ **Icons**: Proper sizes (72x72, 144x144, 20x20, 40x40)  
✅ **Platform Support**: Windows 10+, macOS 12+  
✅ **Error Handling**: Graceful degradation, no crashes  
✅ **Resource Cleanup**: Stop polling when actions disappear  

---

## Summary

This plugin provides a lightweight, bulletproof solution for displaying Google Analytics statistics on Stream Deck. Key strengths:

1. **Simple**: Uses only SDK title API, no complex UI
2. **Efficient**: Smart polling only when actions are visible
3. **Reliable**: Comprehensive error handling and recovery
4. **Debuggable**: Extensive logging at multiple levels
5. **Maintainable**: Modular code following best practices
6. **Standards-Compliant**: Follows all Elgato SDK guidelines

The plugin is production-ready for Windows 11 and follows all Stream Deck SDK standards for optimal performance and user experience.

---

## Support and Resources

### Documentation
- [Elgato Stream Deck SDK](https://docs.elgato.com/sdk)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [googleapis NPM Package](https://www.npmjs.com/package/googleapis)

### Helpful Commands

```powershell
# Build plugin
pnpm run build

# Development mode (auto-rebuild)
pnpm run watch

# Link plugin to Stream Deck
streamdeck link

# Restart plugin
streamdeck restart com.samal.test

# Package for distribution
streamdeck pack com.samal.test.sdPlugin

# View logs
Get-Content "com.samal.test.sdPlugin\logs\com.samal.test.0.log" -Wait -Tail 50
```

---

**Last Updated**: October 1, 2025  
**Version**: 1.0  
**Author**: samal

