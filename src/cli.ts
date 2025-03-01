// eslint-disable-next-line @typescript-eslint/naming-convention
import * as child_process from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { CLI_COMMAND, getDatabasePath } from "./config";

const exec = promisify(child_process.exec);

export async function runCliCommand(args: any[]): Promise<void> {
  const process = child_process.spawn(CLI_COMMAND, args, {
    shell: true,
    stdio: "pipe",
  });

  process.stdout.on("data", (data) => {
    console.log(`[CLI Output]: ${data.toString().trim()}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`[CLI Error]: ${data.toString().trim()}`);
  });

  process.on("close", (code) => {
    console.log(`[CLI] Process exited with code ${code}`);
  });

  process.on("error", (error) => {
    console.error(`[CLI] Failed to execute: ${error.message}`);
  });
  // try {
  //   const { stdout, stderr } = await exec(
  //     `"${CLI_COMMAND}" ${args.map((arg) => `"${arg}"`).join(" ")}`
  //   );

  //   if (stdout) {
  //     console.log(`[CLI Output]: ${stdout.trim()}`);
  //   }

  //   if (stderr) {
  //     console.error(`CLI Error: ${stderr}`);
  //   }
  // } catch (error) {
  //   console.error(`Failed to execute CLI: ${error}`);
  // }
}

export async function initializeDatabase(
  context: vscode.ExtensionContext
): Promise<void> {
  const dbPath = getDatabasePath(context);
  console.log(`Initializing database at ${dbPath}`);
  await runCliCommand(["--db", dbPath]);
}
