import streamDeck from "@elgato/streamdeck";
import { LogLevel } from "@elgato/streamdeck";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

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
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
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

