import * as vscode from "vscode";
import { runCliCommand } from "./cli";
import { APP_NAME, MAX_RETRIES, SYNC_INTERVAL } from "./config";
import { Logger } from "./logger";

let retryAttempts = 0;
let syncInterval: NodeJS.Timeout | null = null;

export function startAutoSync(context: vscode.ExtensionContext): void {
  Logger.debug(`Attempting to sync... (Attempt ${retryAttempts + 1})`);
  syncInterval = setInterval(async () => {
    try {
      await runCliCommand(["sync"]);
      retryAttempts = 0;
    } catch (error) {
      Logger.error(`Failed to sync data: ${error}`);
      retryAttempts++;
      if (retryAttempts < MAX_RETRIES) {
        const delay = Math.pow(2, retryAttempts) * 1000;
        setTimeout(() => runCliCommand(["sync"]), delay);
      } else {
        Logger.error("Max retries reached.");
      }
    }
  }, SYNC_INTERVAL);

  context.subscriptions.push({
    dispose() {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    },
  });
}
