import * as vscode from "vscode";
import { DateTime } from "luxon";
import {
  Category,
  EntityType,
  APP_NAME,
  MIN_HEARTBEAT_INTERVAL,
} from "./config";
import { runCliCommand } from "./cli";
import { Logger } from "./logger";

interface TrackedEvent {
  start: number; // ms
  category: Category;
  project: string;
}

export class SkopioTracker {
  private static instance: SkopioTracker;

  private events = new Map<string, TrackedEvent>();
  private flushedEntities = new Set<string>();

  private context!: vscode.ExtensionContext;
  private idleTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private readonly IDLE_TIMEOUT = 60_000; // 1 minute
  private readonly MIN_ACTIVITY_UPDATE_INTERVAL_MS = 2000; // 2s
  private lastActivityAt = Date.now();
  private lastActivityUpdateAt = 0;

  static getInstance(): SkopioTracker {
    if (!SkopioTracker.instance) {
      SkopioTracker.instance = new SkopioTracker();
    }
    return SkopioTracker.instance;
  }

  public initialize(context: vscode.ExtensionContext) {
    this.context = context;
    this.registerListeners();
    this.startHeartbeatLoop();
  }

  public dispose() {
    this.flushAllEvents();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }

  private normalizeEntityPath(filePath: string): string {
    return filePath.replace(/\.git$/, "");
  }

  private markActivity() {
    const now = Date.now();
    if (
      now - this.lastActivityUpdateAt <
      this.MIN_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      return;
    }
    this.lastActivityAt = now;
    this.lastActivityUpdateAt = now;
    this.resetIdleTimer();
  }

  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      Logger.debug("AFK timeout reached. Flushing events.");
      this.flushAllEvents();
    }, this.IDLE_TIMEOUT);
  }

  private startHeartbeatLoop() {
    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now();
      if (now - this.lastActivityAt < MIN_HEARTBEAT_INTERVAL) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await this.logHeartbeat(editor.document);
        }
      }
    }, MIN_HEARTBEAT_INTERVAL);
  }

  public async logActivity(category: Category, document: vscode.TextDocument) {
    const rawEntity = document.fileName;
    const entity = this.normalizeEntityPath(rawEntity);
    const project = vscode.workspace.getWorkspaceFolder(document.uri)?.uri
      .fsPath;

    if (!project) {
      Logger.warn(`Skipping activity: unknown project for ${rawEntity}`);
      return;
    }

    this.markActivity();

    const existing = this.events.get(entity);
    const now = Date.now();

    if (!existing || existing.category !== category) {
      await this.flushEvent(entity);
      this.events.set(entity, {
        start: now,
        category,
        project,
      });
    }
  }

  public async flushAllEvents() {
    for (const entity of Array.from(this.events.keys())) {
      await this.flushEvent(entity);
    }
  }

  private async flushEvent(entity: string) {
    const normalized = this.normalizeEntityPath(entity);

    if (this.flushedEntities.has(normalized)) {
      Logger.debug(`Already flushing ${normalized}, skipping duplicate`);
      return;
    }

    const event = this.events.get(normalized);
    if (!event) {
      return;
    }

    const end = Date.now();
    const duration = Math.floor((end - event.start) / 1000);

    if (duration <= 0 || !event.project) {
      this.events.delete(normalized);
      return;
    }

    this.flushedEntities.add(normalized);

    await runCliCommand([
      "--app",
      APP_NAME,
      "event",
      "-t",
      Math.floor(event.start / 1000),
      "--end-timestamp",
      Math.floor(end / 1000),
      "-c",
      event.category,
      "-a",
      APP_NAME,
      "-e",
      normalized,
      "--entity-type",
      EntityType.File,
      "-d",
      duration.toString(),
      "-p",
      event.project,
    ]);

    Logger.info(
      `Flushed event for ${normalized} [${event.category}] (${duration}s)`,
    );
    this.events.delete(entity);
    this.flushedEntities.delete(normalized);
  }

  private async logHeartbeat(document: vscode.TextDocument) {
    const rawEntity = document.uri.fsPath;
    const entity = this.normalizeEntityPath(rawEntity);
    const project = vscode.workspace.getWorkspaceFolder(document.uri)?.uri
      .fsPath;

    if (!project) {
      Logger.warn(`Skipping heartbeat: unknown project for ${rawEntity}`);
      return;
    }

    const timestamp = Math.floor(DateTime.now().toSeconds());
    const cursor =
      vscode.window.activeTextEditor?.selection.active.character ?? 0;
    const lines = document.lineCount;

    Logger.debug(`Logging heartbeat for ${entity}`);

    await runCliCommand([
      "--app",
      APP_NAME,
      "heartbeat",
      "-p",
      project,
      "-t",
      timestamp,
      "-e",
      entity,
      "--entity-type",
      EntityType.File,
      "-a",
      APP_NAME,
      "-l",
      lines.toString(),
      "-c",
      cursor.toString(),
    ]);
  }

  private registerListeners() {
    const disposables = this.context.subscriptions;

    const onActivity = (doc: vscode.TextDocument, category: Category) => {
      this.logActivity(category, doc);
    };

    disposables.push(
      vscode.workspace.onDidChangeTextDocument(({ document }) => {
        onActivity(document, Category.Coding);
      }),

      vscode.window.onDidChangeTextEditorSelection(({ textEditor }) => {
        onActivity(textEditor.document, Category.Coding);
      }),

      vscode.window.onDidChangeTextEditorVisibleRanges(() => {
        this.markActivity(); // passive scrolling = weak activity
      }),

      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.flushAllEvents(); // end previous event
        if (editor) {
          this.logActivity(Category.Coding, editor.document);
        }
      }),

      vscode.workspace.onDidOpenTextDocument((document) => {
        if (["markdown", "plaintext"].includes(document.languageId)) {
          onActivity(document, Category.WritingDocs);
        }
      }),

      vscode.debug.onDidStartDebugSession(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          onActivity(editor.document, Category.Debugging);
        }
      }),

      vscode.debug.onDidTerminateDebugSession(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          onActivity(editor.document, Category.Debugging);
        }
      }),

      vscode.tasks.onDidStartTask(({ execution }) => {
        const name = execution.task.name.toLowerCase();
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        if (name.includes("build")) {
          onActivity(editor.document, Category.Compiling);
        } else if (name.includes("test")) {
          onActivity(editor.document, Category.CodeReviewing);
        }
      }),

      vscode.workspace.onDidCloseTextDocument((document) => {
        const entity = document.fileName;
        Logger.debug(`Document closed: ${entity}`);
        this.flushEvent(entity);
      }),
    );
  }
}
