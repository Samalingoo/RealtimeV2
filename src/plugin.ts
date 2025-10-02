import streamDeck from "@elgato/streamdeck";
import { logger } from "./utils/logger";
import { ActiveUsersAction } from "./actions/active-users";
import { DailyPageviewsAction } from "./actions/daily-pageviews";
import { WeeklyPageviewsAction } from "./actions/weekly-pageviews";
import { MonthlyUniqueUsersAction } from "./actions/monthly-unique-users";

// Logger is initialized via singleton, log level set from config
logger.info("Google Analytics Stream Deck Plugin starting...");

// Register all analytics actions
streamDeck.actions.registerAction(new ActiveUsersAction());
streamDeck.actions.registerAction(new DailyPageviewsAction());
streamDeck.actions.registerAction(new WeeklyPageviewsAction());
streamDeck.actions.registerAction(new MonthlyUniqueUsersAction());

logger.info("All actions registered successfully");

// Connect to Stream Deck
streamDeck.connect();

logger.info("Plugin connected to Stream Deck");
