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
  
  // Store previous values to calculate percentage change
  private previousValues = {
    activeUsers: 0,
    dailyPageviews: 0,
    weeklyPageviews: 0,
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
   * Get active users with percentage change from previous poll
   */
  public async getActiveUsersWithChange(): Promise<{ value: number; change: number }> {
    const current = await this.getActiveUsers();
    const previous = this.previousValues.activeUsers;
    
    if (current === -1) {
      return { value: -1, change: 0 };
    }
    
    const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
    this.previousValues.activeUsers = current;
    
    logger.debug(`Active Users change: ${previous} -> ${current} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    
    return { value: current, change };
  }

  /**
   * Get daily pageviews with percentage change from previous poll
   */
  public async getDailyPageviewsWithChange(): Promise<{ value: number; change: number }> {
    const current = await this.getDailyPageviews();
    const previous = this.previousValues.dailyPageviews;
    
    if (current === -1) {
      return { value: -1, change: 0 };
    }
    
    const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
    this.previousValues.dailyPageviews = current;
    
    logger.debug(`Daily Pageviews change: ${previous} -> ${current} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    
    return { value: current, change };
  }

  /**
   * Get weekly pageviews with percentage change from previous poll
   */
  public async getWeeklyPageviewsWithChange(): Promise<{ value: number; change: number }> {
    const current = await this.getWeeklyPageviews();
    const previous = this.previousValues.weeklyPageviews;
    
    if (current === -1) {
      return { value: -1, change: 0 };
    }
    
    const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
    this.previousValues.weeklyPageviews = current;
    
    logger.debug(`Weekly Pageviews change: ${previous} -> ${current} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`);
    
    return { value: current, change };
  }
}

