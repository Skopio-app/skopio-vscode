import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import * as fs from "fs";

export const SYNC_INTERVAL = 60000;
export const MAX_RETRIES = 4;
export const APP_NAME = "Code";
export const MIN_HEARTBEAT_INTERVAL = 2 * 1000;
export const CLI_INSTALL_DIR = path.join(os.homedir(), ".skopio", "bin");
export const CLI_BIN_NAME = "skopio-cli";
export const GH_OWNER_REPO = "Samuel-dot-cloud/skopio";

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

export function getDBDirectoryPath(context: vscode.ExtensionContext): string {
  const storagePath = context.globalStorageUri.fsPath;

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return storagePath;
}
