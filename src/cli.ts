import * as vscode from "vscode";
import { CLI_BIN_NAME, CLI_INSTALL_DIR, GH_OWNER_REPO, IS_DEV } from "./config";
import { Logger } from "./logger";
import { CliManager } from "./dependency";

let _manager: CliManager | undefined;

function resolveDevPath(): string | undefined {
  if (!IS_DEV) {
    return undefined;
  }
  const devPath = vscode.workspace
    .getConfiguration("skopio")
    .get<string>("cli.devPath");
  return devPath?.trim() || undefined;
}

export function getCliManager(): CliManager {
  if (!_manager) {
    _manager = new CliManager({
      ownerRepo: GH_OWNER_REPO,
      installDir: CLI_INSTALL_DIR,
      binName: CLI_BIN_NAME,
      overridePath: resolveDevPath(),
    });
  }
  return _manager;
}

export async function ensureCliAtStartup(): Promise<CliManager> {
  const mgr = getCliManager();
  if (!mgr.isManaged) {
    if (!(await mgr.exists())) {
      throw new Error(`Skopio CLI devPath not found: ${mgr.path}`);
    }
    return mgr;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: "Installing Skopio CLI…",
    },
    async () => mgr.ensureUpToDate({ background: false, timeoutMs: 20_000 }),
  );

  return mgr;
}

export async function runCliCommand(args: any[]): Promise<void> {
  const mgr = getCliManager();
  if (!(await mgr.exists())) {
    Logger.error("Skopio CLI is not installed yet");
  }
  const { stdout, stderr } = await mgr.run(args);
  if (stderr) {
    Logger.warn(stderr.trim());
  }
  if (stdout) {
    Logger.info(stdout.trim());
  }
}
