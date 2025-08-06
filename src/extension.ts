import * as vscode from "vscode";
import { initializeDatabase } from "./cli";
import { startAutoSync } from "./syncManager";
import { Logger } from "./logger";
import { SkopioTracker } from "./skopio";

export async function activate(context: vscode.ExtensionContext) {
  await initializeDatabase(context);
  SkopioTracker.getInstance().initialize(context);
  startAutoSync(context);
  Logger.debug("Skopio extension activated.");
}

export function deactivate() {
  SkopioTracker.getInstance().dispose();
  Logger.debug("Skopio extension deactivated");
}
