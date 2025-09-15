import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

export const SYNC_INTERVAL = 60000;
export const MAX_RETRIES = 4;
export const APP_NAME = vscode.env.appName;
export const CLI_INSTALL_DIR = path.join(os.homedir(), ".skopio", "bin");
export const CLI_BIN_NAME = "skopio-cli";
export const GH_OWNER_REPO = "Skopio-app";
export const SOURCE = "skopio-vscode";
export const IS_DEV = vscode.ExtensionMode.Development;

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
