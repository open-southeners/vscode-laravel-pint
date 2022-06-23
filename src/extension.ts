// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path = require('path');
import { commands, ExtensionContext, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';

let saveWhenFormatted = false;
let outputChannel: OutputChannel | null;

function getActiveDocumentPath() {
  const activeDocumentUri = window.activeTextEditor?.document.uri;

  if (!activeDocumentUri) {
    return undefined;
  }

  return activeDocumentUri;
}

function format(file: Uri, config: WorkspaceConfiguration) {
  const workspaceRootPath = workspace.workspaceFolders?.[0].uri.fsPath;
  let executableFullPath = config.get<string>('executablePath');
  let preset = config.get<string>('preset');

  if (executableFullPath && !path.isAbsolute(executableFullPath) && workspaceRootPath) {
    executableFullPath = path.posix.resolve(workspaceRootPath, executableFullPath);
  }
  
  if (!executableFullPath || !existsSync(executableFullPath)) {
    return window.showErrorMessage('Executable not found for Laravel Pint.');
  }

  outputChannel?.appendLine(`Formatting file "${workspace.asRelativePath(file.path)}"`);
  
  const exec = spawn(executableFullPath, [workspace.asRelativePath(file.path), '--preset', preset], {
    cwd: workspaceRootPath
  });
}

export function activate(context: ExtensionContext) {
  outputChannel = window.createOutputChannel("Laravel Pint");
  const config = workspace.getConfiguration('laravel-pint');

  context.subscriptions.push(commands.registerCommand('laravel-pint.format', () => {
    if (window.activeTextEditor?.document.languageId !== 'php') {
      return;
    }

    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
      format(activeEditorFile, config);
    }
  }));

  context.subscriptions.push(workspace.onWillSaveTextDocument((e) => {
    if (e.document.languageId !== 'php' || saveWhenFormatted === true) {
      return;
    }
    
    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
      outputChannel?.appendLine(JSON.stringify(activeEditorFile));

      format(activeEditorFile, config);
    }
  }));
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (outputChannel) {
    outputChannel.clear();
    outputChannel.dispose();
  }

  outputChannel = null;
}
