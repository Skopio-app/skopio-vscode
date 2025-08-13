import * as vscode from "vscode";
import { initializeDatabase, scheduleBackgroundRefresh } from "./cli";
import { startAutoSync } from "./sync";
import { Logger, LogLevel } from "./logger";
import { SkopioTracker } from "./skopio";

const CHECK_KEY = "skopio.cli.lastCheck";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function activate(context: vscode.ExtensionContext) {
  Logger.setLogLevel(
    process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  );

  const last = context.globalState.get<number>(CHECK_KEY, 0);
  if (Date.now() - last > CHECK_INTERVAL_MS) {
    scheduleBackgroundRefresh(10_000);
    context.globalState.update(CHECK_KEY, Date.now());
  }

  await initializeDatabase(context);
  SkopioTracker.getInstance().initialize(context);
  startAutoSync(context);
  Logger.debug("Skopio extension activated.");
}

export async function deactivate() {
  await SkopioTracker.getInstance().dispose();
  Logger.debug("Skopio extension deactivated");
}
