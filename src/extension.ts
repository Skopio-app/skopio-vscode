import * as vscode from "vscode";
import { startAutoSync } from "./sync";
import { Logger, LogLevel } from "./logger";
import { SkopioTracker } from "./skopio";
import { ensureCliAtStartup } from "./cli";

export async function activate(context: vscode.ExtensionContext) {
  Logger.setLogLevel(
    process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  );

  await ensureCliAtStartup();
  SkopioTracker.getInstance().initialize(context);
  startAutoSync(context);
  Logger.debug("Skopio extension activated.");
}

export async function deactivate() {
  await SkopioTracker.getInstance().dispose();
  Logger.debug("Skopio extension deactivated");
}
