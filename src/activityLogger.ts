import * as vscode from "vscode";
import { DateTime } from "luxon";
import { runCliCommand } from "./cli";
import { Logger } from "./logger";
import { APP_NAME, EntityType } from "./config";

const EVENT_INTERVAL = 60 * 1000;
let activeEvents: Map<
  string,
  {
    timestamp: number;
    activityType: string;
    duration: number;
    language: string;
    project: string;
  }
> = new Map();
let lastLineCounts: Map<string, number> = new Map();
let lastActivityTimestamp: number = DateTime.now().toSeconds();

export async function logActivity(
  activityType: string,
  document: vscode.TextDocument,
): Promise<void> {
  const projectPath =
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "unknown";
  const entity = document.fileName;
  const language = document.languageId;
  const now = Math.floor(DateTime.now().toSeconds());

  if (activeEvents.has(entity)) {
    let event = activeEvents.get(entity);

    if (event?.activityType === activityType) {
      event.duration += now - lastActivityTimestamp;
    } else {
      await logSummarizedEvent(entity);
      activeEvents.set(entity, {
        timestamp: now,
        activityType,
        duration: 0,
        language,
        project: projectPath,
      });
    }
  } else {
    activeEvents.set(entity, {
      timestamp: now,
      activityType,
      duration: 0,
      language,
      project: projectPath,
    });
  }

  lastActivityTimestamp = now;
  Logger.info(
    `Updated event: ${activityType} | File: ${entity} | Language: ${language} | Project: ${projectPath} | Duration: ${
      activeEvents.get(entity)?.duration
    }s`,
  );

  // Immediately log a heartbeat when an event occurs.
  await logHeartbeat(document, false);
}

async function logSummarizedEvent(entity: string): Promise<void> {
  if (!activeEvents.has(entity)) {
    return;
  }

  let { timestamp, activityType, duration, project } =
    activeEvents.get(entity)!;
  const endTimestamp = Math.floor(DateTime.now().toSeconds());

  await runCliCommand([
    "--app",
    APP_NAME,
    "event",
    "-t",
    timestamp,
    "-c",
    activityType,
    "-a",
    APP_NAME,
    "-e",
    entity,
    "--entity-type",
    EntityType.File,
    "-d",
    duration.toFixed(),
    "-p",
    project,
    "--end-timestamp",
    endTimestamp,
  ]);

  Logger.info(
    `Logged summarized event: ${activityType} | File: ${entity} | Project: ${project} | Duration: ${duration}s`,
  );

  activeEvents.delete(entity);
}

export async function logHeartbeat(
  document: vscode.TextDocument,
  isWrite: boolean,
): Promise<void> {
  const projectPath =
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "unknown";
  const entity = document.fileName;
  const cursorpos =
    vscode.window.activeTextEditor?.selection.active.character ?? 0;
  const timestamp = Math.floor(DateTime.now().toSeconds());

  let previousLines = lastLineCounts.get(entity) || document.lineCount;
  let newLines = document.lineCount;
  let linesEdited = Math.abs(newLines - previousLines);

  lastLineCounts.set(entity, newLines);

  Logger.info(
    `Logging ${
      isWrite ? "write" : "edit"
    } heartbeat for: ${entity} | Lines edited: ${linesEdited}`,
  );

  let args = [
    "--app",
    APP_NAME,
    "heartbeat",
    "-p",
    projectPath,
    "-t",
    timestamp,
    "-e",
    entity,
    "--entity-type",
    EntityType.File,
    "-a",
    APP_NAME,
    "-l",
    linesEdited.toString(),
    "-c",
    cursorpos.toString(),
  ];

  if (isWrite) {
    args.push("-i");
  }

  await runCliCommand(args);
}

setInterval(async () => {
  for (const entity of activeEvents.keys()) {
    await logSummarizedEvent(entity);
  }
}, EVENT_INTERVAL);
