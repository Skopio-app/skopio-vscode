import * as vscode from "vscode";
import { initializeDatabase } from "./cli";
import { startAutoSync } from "./sync";
import { Logger } from "./logger";
import { SkopioTracker } from "./skopio";

export async function activate(context: vscode.ExtensionContext) {
  await initializeDatabase(context);
  SkopioTracker.getInstance().initialize(context);
  startAutoSync(context);
  Logger.debug("Skopio extension activated.");
}

export async function deactivate() {
  await SkopioTracker.getInstance().dispose();
  Logger.debug("Skopio extension deactivated");
}
