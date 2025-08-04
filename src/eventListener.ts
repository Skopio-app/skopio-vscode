import * as vscode from "vscode";
import { logActivity, logHeartbeat } from "./activityLogger";
import { Category, MIN_HEARTBEAT_INTERVAL } from "./config";

let lastHeartbeat = 0;

export function registerEventListeners(context: vscode.ExtensionContext): void {
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const now = Date.now();
      if (now - lastHeartbeat >= MIN_HEARTBEAT_INTERVAL) {
        lastHeartbeat = now;
        await logHeartbeat(event.document, false);
      }
    }),

    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await logHeartbeat(document, true);
    }),

    vscode.window.onDidChangeTextEditorSelection(async (event) => {
      const now = Date.now();
      if (now - lastHeartbeat >= MIN_HEARTBEAT_INTERVAL) {
        lastHeartbeat = now;
        await logHeartbeat(event.textEditor.document, false);
      }
    }),

    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document) {
        await logActivity(Category.Coding, editor.document);
      }
    }),

    vscode.debug.onDidStartDebugSession(async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await logActivity(Category.Debugging, editor.document);
      }
    }),

    vscode.debug.onDidTerminateDebugSession(async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await logActivity(Category.Debugging, editor.document);
      }
    }),

    vscode.tasks.onDidStartTask(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        if (event.execution.task.name.toLowerCase().includes("build")) {
          await logActivity(Category.Compiling, editor.document);
        } else if (event.execution.task.name.toLowerCase().includes("test")) {
          await logActivity(Category.Testing, editor.document);
        }
      }
    }),

    vscode.tasks.onDidEndTask(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        if (event.execution.task.name.toLowerCase().includes("build")) {
          await logActivity(Category.Compiling, editor.document);
        } else if (event.execution.task.name.toLowerCase().includes("test")) {
          await logActivity(Category.Testing, editor.document);
        }
      }
    }),

    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (
        document.languageId === "markdown" ||
        document.languageId === "plaintext"
      ) {
        await logActivity(Category.WritingDocs, document);
      }
    }),
  );

  // Register all disposables for proper cleanup
  context.subscriptions.push(vscode.Disposable.from(...disposables));
}
