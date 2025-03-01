import * as vscode from "vscode";
import { DateTime } from "luxon";
import { runCliCommand } from "./cli";

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

export async function logActivity(
  activityType: string,
  document: vscode.TextDocument
): Promise<void> {
  const projectPath =
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "unknown";
  const entity = document.fileName;
  const language = document.languageId;
  const now = Math.floor(DateTime.now().toSeconds());

  if (activeEvents.has(entity)) {
    let event = activeEvents.get(entity);

    if (event?.activityType === activityType) {
      event.duration += 5;
    } else {
      await logSummarizedEvent(entity);
      activeEvents.set(entity, {
        timestamp: now,
        activityType,
        duration: 5,
        language,
        project: projectPath,
      });
    }
  } else {
    activeEvents.set(entity, {
      timestamp: now,
      activityType,
      duration: 5,
      language,
      project: projectPath,
    });
  }

  console.log(
    `[Activity] Updated event: ${activityType} | File: ${entity} | Language: ${language} | Project: ${projectPath} | Duration: ${
      activeEvents.get(entity)?.duration
    }s`
  );

  // Immediately log a heartbeat when an event occurs.
  await logHeartbeat(document, false);
}

async function logSummarizedEvent(entity: string): Promise<void> {
  if (!activeEvents.has(entity)) {
    return;
  }

  let { timestamp, activityType, duration, language, project } =
    activeEvents.get(entity)!;
  const endTimestamp = Math.floor(DateTime.now().toSeconds());

  await runCliCommand([
    "event",
    "--timestamp", timestamp,
    "--activity-type", activityType,
    "--app", "vscode",
    "--entity", entity,
    "--entity-type", "file",
    "--duration", duration.toFixed(),
    "--project", project,
    "--language", language,
    "--end-timestamp", endTimestamp,
  ]);

  console.log(
    `[Event] Logged summarized event: ${activityType} | File: ${entity} | Language: ${language} | Project: ${project} | Duration: ${duration}s`
  );

  activeEvents.delete(entity);
}

export async function logHeartbeat(
  document: vscode.TextDocument,
  isWrite: boolean
): Promise<void> {
  const projectPath =
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "unknown";
  const entity = document.fileName;
  const language = document.languageId;
  const app = "vscode";
  const cursorpos =
    vscode.window.activeTextEditor?.selection.active.character ?? 0;

  let previousLines = lastLineCounts.get(entity) || 0;
  let newLines = document.lineCount;
  let linesEdited = Math.abs(newLines - previousLines);

//   if (linesEdited === 0) {
//     return;
//   }

  lastLineCounts.set(entity, newLines);
  const timestamp = Math.floor(DateTime.now().toSeconds());

  console.log(
    `[Heartbeat] Logging ${
      isWrite ? "write" : "edit"
    } heartbeat for: ${entity} | Lines edited: ${linesEdited}`
  );

  let args = [
    "heartbeat",
    "--project", projectPath,
    "--timestamp", timestamp,
    "--entity", entity,
    "--entity-type", "file",
    "--language", language,
    "--app", app,
    "--lines", linesEdited.toString(),
    "--cursorpos", cursorpos.toString(),
  ];

  if (isWrite) {
    args.push("--is-write");
  }

  await runCliCommand(args);
}

setInterval(async () => {
  for (const entity of activeEvents.keys()) {
    await logSummarizedEvent(entity);
  }
}, EVENT_INTERVAL);
