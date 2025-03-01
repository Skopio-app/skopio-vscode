import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import * as fs from "fs";

const HOME_DIR = os.homedir();
export const CLI_COMMAND = path.join(
  HOME_DIR,
  "CodeProjects/timestack/target/debug/cli"
);
export const SYNC_INTERVAL = 60000;

export function getDatabasePath(context: vscode.ExtensionContext): string {
  const storagePath = context.globalStorageUri.fsPath;

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return path.join(storagePath, "timestack-cli-data.db");
}
