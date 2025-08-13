import * as vscode from "vscode";
import {
  APP_NAME,
  CLI_BIN_NAME,
  CLI_INSTALL_DIR,
  getDBDirectoryPath,
  GH_OWNER_REPO,
} from "./config";
import { Logger } from "./logger";
import { CliManager } from "./dependency";

let _manager: CliManager | undefined;

export function getCliManager(): CliManager {
  if (!_manager) {
    _manager = new CliManager({
      ownerRepo: GH_OWNER_REPO,
      installDir: CLI_INSTALL_DIR,
      binName: CLI_BIN_NAME,
    });
  }
  return _manager;
}

export async function ensureCliOnFirstUse(): Promise<CliManager> {
  const mgr = getCliManager();
  if (!(await mgr.exists())) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Installing Skopio CLI…",
      },
      async () => mgr.ensureUpToDate({ background: false, timeoutMs: 20_000 }),
    );
  }
  return mgr;
}

export function scheduleBackgroundRefresh(timeoutMs = 10_000): void {
  const mgr = getCliManager();
  setTimeout(() => {
    mgr.ensureUpToDate({ background: true, timeoutMs }).catch(() => {});
  }, 1500);
}

export async function runCliCommand(args: any[]): Promise<void> {
  const mgr = await ensureCliOnFirstUse();
  const { stdout, stderr } = await mgr.run(args);
  if (stderr) {
    Logger.warn(stderr.trim());
  }
  if (stdout) {
    Logger.info(stdout.trim());
  }
}

export async function initializeDatabase(
  context: vscode.ExtensionContext,
): Promise<void> {
  const dbDir = getDBDirectoryPath(context);
  Logger.debug(`Initializing database directory at ${dbDir}`);

  try {
    await runCliCommand(["--dir", dbDir, "--app", APP_NAME]);
  } catch (error) {
    Logger.error(`Failed to initialize database: ${error}`);
  }
}
