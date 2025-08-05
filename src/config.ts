import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import * as fs from "fs";

const HOME_DIR = os.homedir();
export const CLI_COMMAND = path.join(
  HOME_DIR,
  "CodeProjects/skopio/target/debug/cli",
);
export const SYNC_INTERVAL = 60000;
export const MAX_RETRIES = 4;
export const APP_NAME = "Code";
export const MIN_HEARTBEAT_INTERVAL = 2 * 1000;

export enum Category {
  Coding = "Coding",
  Debugging = "Debugging",
  Compiling = "Compiling",
  WritingDocs = "Writing Docs",
  CodeReviewing = "Code Reviewing",
  Testing = "Testing",
}

export enum EntityType {
  File = "File",
  App = "App",
  Url = "Url",
}

export function getDatabasePath(context: vscode.ExtensionContext): string {
  const storagePath = context.globalStorageUri.fsPath;

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return path.join(storagePath, `skopio-${APP_NAME}-data.db`);
}
