import * as vscode from "vscode";
import { Category, EntityType, APP_NAME, SOURCE } from "./config";
import { runCliCommand } from "./cli";
import { Logger } from "./logger";

interface TrackedEvent {
  start: number; // ms
  category: Category;
  project: string;
}

// TODO: Add support for tracking in vscode web version
export class SkopioTracker {
  private static instance: SkopioTracker;

  private events = new Map<string, TrackedEvent>();
  private flushedEntities = new Set<string>();
  private flushing = new Set<string>();
  private flushDebounce = new Map<string, NodeJS.Timeout>();

  private context!: vscode.ExtensionContext;
  private idleTimer: NodeJS.Timeout | null = null;

  private readonly IDLE_TIMEOUT = 60_000; // 1 minute
  private readonly MIN_ACTIVITY_UPDATE_INTERVAL_MS = 2000; // 2s
  private readonly NOTEBOOK_EDIT_DEBOUNCE_MS = 3000;
  private lastActivityUpdateAt = 0;
  private currentEntity: string | null = null;

  static getInstance(): SkopioTracker {
    if (!SkopioTracker.instance) {
      SkopioTracker.instance = new SkopioTracker();
    }
    return SkopioTracker.instance;
  }

  public initialize(context: vscode.ExtensionContext) {
    this.context = context;
    this.registerListeners();
  }

  public async dispose() {
    await this.flushAllEvents();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }

  private normalizeEntityPath(filePath: string): string {
    return filePath.replace(/\.git$/, "");
  }

  private setCategory(doc: vscode.TextDocument): Category {
    return doc.languageId === "markdown" || doc.languageId === "plaintext"
      ? Category.WritingDocs
      : Category.Coding;
  }

  /**
   * Records the current time as the user's last active moment,
   * and resets the idle timeout timer.
   *
   * This prevents heartbeats or events from being logged if the user is inactive.
   * A minimum update interval prevents it from resetting too frequently.
   */
  private markActivity() {
    const now = Date.now();
    if (
      now - this.lastActivityUpdateAt <
      this.MIN_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      return;
    }
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

  /**
   * Starts or updates a tracked event for a given document and activity category.
   *
   * - If an event is already active for this file and same category, it continue.
   * - If the category differs or no event exists, flushes the old ane and starts a new event.
   * - Updates the project path for the new event
   */
  public async saveEvent(category: Category, uri: vscode.Uri) {
    const entity = this.normalizeEntityPath(uri.fsPath);
    const project = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;

    if (!project) {
      Logger.warn(`Skipping activity: unknown project for ${entity}`);
      return;
    }

    this.markActivity();

    const now = Date.now();
    const existing = this.events.get(entity);

    const switchingFile =
      this.currentEntity !== null && this.currentEntity !== entity;
    const categoryChanged = existing && existing.category !== category;

    if (switchingFile || categoryChanged) {
      const others = Array.from(this.events.keys()).filter((e) => e !== entity);
      await Promise.all(others.map((e) => this.flushEvent(e, { force: true })));
    }

    if (!existing || existing.category !== category) {
      this.events.set(entity, {
        start: now,
        category,
        project,
      });
    } else if (existing.project !== project) {
      this.events.set(entity, { ...existing, project });
    }

    this.currentEntity = entity;
  }

  public async flushAllEvents() {
    await Promise.all(
      Array.from(this.events.keys()).map((entity) =>
        this.flushEvent(entity, { force: false }),
      ),
    );
  }

  private async flushEvent(entity: string, opts?: { force?: boolean }) {
    const normalized = this.normalizeEntityPath(entity);
    const force = Boolean(opts?.force);

    const event = this.events.get(normalized);
    if (!event) {
      return;
    }

    if (this.flushDebounce.has(normalized)) {
      clearTimeout(this.flushDebounce.get(normalized)!);
      this.flushDebounce.delete(normalized);
    }

    const DEBOUNCE_MS = 150;
    const schedule = async () => {
      if (this.flushing.has(normalized)) {
        return;
      }
      this.flushing.add(normalized);

      try {
        const end = Date.now();
        const duration = Math.floor((end - event.start) / 1000);

        if (!force && (duration <= 0 || !event.project)) {
          this.events.delete(normalized);
          return;
        }

        await runCliCommand([
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
          "-s",
          SOURCE,
          "-p",
          event.project,
        ]);

        Logger.info(
          `Flushed event for ${normalized} [${event.category}] (${duration}s)`,
        );
        this.events.delete(normalized);
      } catch (err) {
        Logger.error(`Flush failed for ${normalized}: ${String(err)}`);
      } finally {
        this.flushing.delete(normalized);
        this.flushedEntities.delete(normalized);
      }
    };

    if (force) {
      await schedule();
    } else {
      const t = setTimeout(schedule, DEBOUNCE_MS);
      this.flushDebounce.set(normalized, t);
    }
  }

  private registerListeners() {
    const disposables = this.context.subscriptions;
    const notebookEditTimers = new Map<string, NodeJS.Timeout>();

    disposables.push(
      vscode.workspace.onDidChangeTextDocument(({ document }) => {
        this.saveEvent(this.setCategory(document), document.uri);
      }),

      vscode.window.onDidChangeTextEditorSelection(({ textEditor }) => {
        this.saveEvent(
          this.setCategory(textEditor.document),
          textEditor.document.uri,
        );
      }),

      vscode.window.onDidChangeTextEditorVisibleRanges(() => {
        this.markActivity();
      }),

      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.flushAllEvents();
        if (editor) {
          this.saveEvent(
            this.setCategory(editor.document),
            editor.document.uri,
          );
        } else {
          this.currentEntity = null;
        }
      }),

      vscode.workspace.onDidOpenTextDocument((document) => {
        this.saveEvent(this.setCategory(document), document.uri);
      }),

      vscode.workspace.onDidSaveTextDocument((document) => {
        this.saveEvent(this.setCategory(document), document.uri);
      }),

      vscode.debug.onDidStartDebugSession(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          this.saveEvent(Category.Debugging, editor.document.uri);
        }
      }),

      vscode.debug.onDidChangeActiveDebugSession((session) => {
        if (!session) {
          return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const entity = this.normalizeEntityPath(editor.document.fileName);
        this.flushEvent(entity);
        this.saveEvent(Category.Debugging, editor.document.uri);
      }),

      vscode.debug.onDidTerminateDebugSession(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const entity = this.normalizeEntityPath(editor.document.fileName);
          this.flushEvent(entity);
        }
      }),

      vscode.tasks.onDidStartTask(({ execution }) => {
        const name = execution.task.name.toLowerCase();
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        if (name.includes("build")) {
          this.saveEvent(Category.Compiling, editor.document.uri);
        } else if (name.includes("test")) {
          this.saveEvent(Category.CodeReviewing, editor.document.uri);
        }
      }),

      vscode.tasks.onDidEndTask(({ execution }) => {
        const name = execution.task.name.toLowerCase();
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const document = editor.document;
        const entity = this.normalizeEntityPath(document.fileName);

        if (name.includes("build")) {
          this.saveEvent(Category.Compiling, editor.document.uri);
          this.flushEvent(entity);
        } else if (name.includes("test")) {
          this.saveEvent(Category.CodeReviewing, editor.document.uri);
          this.flushEvent(entity);
        }
      }),

      vscode.debug.onDidChangeBreakpoints(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          this.saveEvent(Category.Debugging, editor.document.uri);
        }
      }),

      vscode.workspace.onDidCloseTextDocument((document) => {
        const entity = this.normalizeEntityPath(document.fileName);
        Logger.debug(`Document closed: ${entity}`);
        void this.flushEvent(entity, { force: true });
        if (this.currentEntity === entity) {
          this.currentEntity = null;
        }
      }),

      vscode.workspace.onDidOpenNotebookDocument((notebook) => {
        this.saveEvent(Category.Coding, notebook.uri);
      }),

      vscode.workspace.onDidChangeNotebookDocument((event) => {
        const uri = event.notebook.uri;

        const didExecute = event.cellChanges.some(
          (change) =>
            change.cell.metadata?.executionSummary?.success !== undefined,
        );

        if (didExecute) {
          this.saveEvent(Category.Compiling, uri);
          return;
        }

        const path = uri.fsPath;
        if (notebookEditTimers.has(path)) {
          clearTimeout(notebookEditTimers.get(path)!);
        }

        notebookEditTimers.set(
          path,
          setTimeout(() => {
            this.saveEvent(Category.Coding, uri);
            notebookEditTimers.delete(path);
          }, this.NOTEBOOK_EDIT_DEBOUNCE_MS),
        );
      }),

      vscode.workspace.onDidSaveNotebookDocument((notebook) => {
        this.saveEvent(Category.Coding, notebook.uri);
      }),
    );
  }
}
