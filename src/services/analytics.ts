import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
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
  private auth: any = null;
  private propertyId: string;
  private isInitialized = false;
  
  // Store 30-minute snapshot for active users comparison
  private activeUsersSnapshot = {
    value: 0,
    timestamp: 0,
  };

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

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
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

  /**
   * Get active users with percentage change from 30 minutes ago
   */
  public async getActiveUsersWithChange(): Promise<{ value: number; change: number }> {
    const current = await this.getActiveUsers();
    
    if (current === -1) {
      return { value: -1, change: 0 };
    }
    
    const now = Date.now();
    const thirtyMinutesAgo = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Update snapshot if it's older than 30 minutes or first run
    if (now - this.activeUsersSnapshot.timestamp >= thirtyMinutesAgo) {
      if (this.activeUsersSnapshot.timestamp === 0) {
        // First run - no comparison yet
        this.activeUsersSnapshot = { value: current, timestamp: now };
        return { value: current, change: 0 };
      }
      
      // Calculate change from 30-min-old snapshot
      const previous = this.activeUsersSnapshot.value;
      const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
      
      // Update snapshot for next comparison
      this.activeUsersSnapshot = { value: current, timestamp: now };
      
      logger.debug(`Active Users change (30-min): ${previous} -> ${current} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
      
      return { value: current, change };
    }
    
    // Within 30-min window - compare to snapshot
    const previous = this.activeUsersSnapshot.value;
    const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
    
    logger.debug(`Active Users vs 30-min ago: ${previous} -> ${current} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    
    return { value: current, change };
  }

  /**
   * Get daily pageviews with percentage change vs yesterday
   */
  public async getDailyPageviewsWithChange(): Promise<{ value: number; change: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.debug("Fetching daily pageviews with comparison to yesterday...");

      const analyticsData = google.analyticsdata("v1beta");
      const response = await analyticsData.properties.runReport({
        auth: this.auth!,
        property: this.propertyId,
        requestBody: {
          dateRanges: [
            { startDate: "1daysAgo", endDate: "today" },      // Today (last 24hrs)
            { startDate: "2daysAgo", endDate: "1daysAgo" },   // Yesterday
          ],
          metrics: [{ name: "screenPageViews" }],
        },
      });

      // GA4 API returns each date range as a separate row with dimensionValues indicating which range
      const rows = response.data.rows || [];
      
      // Find rows by date_range dimension
      const todayRow = rows.find(r => r.dimensionValues?.[0]?.value === "date_range_0");
      const yesterdayRow = rows.find(r => r.dimensionValues?.[0]?.value === "date_range_1");
      
      const today = parseInt(todayRow?.metricValues?.[0]?.value || "0");
      const yesterday = parseInt(yesterdayRow?.metricValues?.[0]?.value || "0");
      
      const change = yesterday === 0 ? 0 : ((today - yesterday) / yesterday) * 100;
      
      logger.debug(`Daily Pageviews: today=${today}, yesterday=${yesterday}, change=${change >= 0 ? "+" : ""}${change.toFixed(1)}%`);
      
      return { value: today, change };
    } catch (error) {
      logger.error("Error fetching daily pageviews with change:", error);
      return { value: -1, change: 0 };
    }
  }

  /**
   * Get weekly pageviews with percentage change vs last week
   */
  public async getWeeklyPageviewsWithChange(): Promise<{ value: number; change: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.debug("Fetching weekly pageviews with comparison to last week...");

      const analyticsData = google.analyticsdata("v1beta");
      const response = await analyticsData.properties.runReport({
        auth: this.auth!,
        property: this.propertyId,
        requestBody: {
          dateRanges: [
            { startDate: "7daysAgo", endDate: "today" },      // This week (last 7 days)
            { startDate: "14daysAgo", endDate: "7daysAgo" },  // Last week
          ],
          metrics: [{ name: "screenPageViews" }],
        },
      });

      // GA4 API returns each date range as a separate row with dimensionValues indicating which range
      const rows = response.data.rows || [];
      
      // Find rows by date_range dimension
      const thisWeekRow = rows.find(r => r.dimensionValues?.[0]?.value === "date_range_0");
      const lastWeekRow = rows.find(r => r.dimensionValues?.[0]?.value === "date_range_1");
      
      const thisWeek = parseInt(thisWeekRow?.metricValues?.[0]?.value || "0");
      const lastWeek = parseInt(lastWeekRow?.metricValues?.[0]?.value || "0");
      
      const change = lastWeek === 0 ? 0 : ((thisWeek - lastWeek) / lastWeek) * 100;
      
      logger.debug(`Weekly Pageviews: thisWeek=${thisWeek}, lastWeek=${lastWeek}, change=${change >= 0 ? "+" : ""}${change.toFixed(1)}%`);
      
      return { value: thisWeek, change };
    } catch (error) {
      logger.error("Error fetching weekly pageviews with change:", error);
      return { value: -1, change: 0 };
    }
  }
}

