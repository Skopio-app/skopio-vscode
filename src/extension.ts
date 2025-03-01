import * as vscode from "vscode";
import { initializeDatabase, runCliCommand } from "./cli";
import { registerEventListeners } from "./eventListener";
import { startAutoSync } from "./syncManager";

export async function activate(context: vscode.ExtensionContext) {
  await initializeDatabase(context);
  registerEventListeners(context);
  startAutoSync(context);

  let syncCommand = vscode.commands.registerCommand(
    "timestack.sync",
    async () => {
      await runCliCommand(["sync"]);
    }
  );

  context.subscriptions.push(syncCommand);
  console.log("Timestack extension activated.");
}

export function deactivate() {
  console.log("Timestack extension deactivated");
}
