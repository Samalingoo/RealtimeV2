import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
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
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
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

