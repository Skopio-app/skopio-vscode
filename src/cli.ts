// eslint-disable-next-line @typescript-eslint/naming-convention
import * as child_process from "child_process";
import * as vscode from "vscode";
import { CLI_COMMAND, getDatabasePath } from "./config";
import { Logger } from "./logger";

export async function runCliCommand(args: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    child_process.execFile(
      CLI_COMMAND,
      args,
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          Logger.error(`CLI execution error: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          Logger.warn(`CLI stderr: ${stderr.trim()}`);
        }
        if (stdout) {
          Logger.info(`CLI output: ${stdout.trim()}`);
        }
        resolve();
      },
    );
  });
}

export async function initializeDatabase(
  context: vscode.ExtensionContext,
): Promise<void> {
  const dbPath = getDatabasePath(context);
  Logger.info(`Initializing database at ${dbPath}`);

  try {
    await runCliCommand(["--db", dbPath]);
  } catch (error) {
    Logger.error(`Failed to initialize database: ${error}`);
  }
}
