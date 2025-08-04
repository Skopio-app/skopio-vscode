import * as vscode from "vscode";
import { initializeDatabase, runCliCommand } from "./cli";
import { registerEventListeners } from "./eventListener";
import { startAutoSync } from "./syncManager";
import { Logger } from "./logger";

export async function activate(context: vscode.ExtensionContext) {
  await initializeDatabase(context);
  registerEventListeners(context);
  startAutoSync(context);

  // let syncCommand = vscode.commands.registerCommand("skopio.sync", async () => {
  //   await runCliCommand(["sync"]);
  // });

  // context.subscriptions.push([]);
  Logger.debug("Skopio extension activated.");
}

export function deactivate() {
  Logger.info("Skopio extension deactivated");
}
