import { spawn } from 'child_process';
import { commands, ExtensionContext, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { buildCommandFromConfig, getActiveDocumentPath, getWorkspaceRootPath } from './util';

let outputChannel: OutputChannel | null;

async function format(file: Uri, config: WorkspaceConfiguration) {
  const filePath = workspace.asRelativePath(file.path);
  let command: string | undefined;
  const commandParts = await buildCommandFromConfig(filePath, config);

  if (commandParts === false || !(command = commandParts.shift())) {
    return;
  }
  
  // Use this for debugging purposes...
  outputChannel?.appendLine(`Formatting file "${filePath}" using command "${command} ${commandParts.join(' ')}"`);

  const exec = spawn(command, commandParts, {
    cwd: getWorkspaceRootPath()
  });
}

function getWorkspaceConfig() {
  return workspace.getConfiguration('laravel-pint');
}

export function activate(context: ExtensionContext) {
  outputChannel = window.createOutputChannel('Laravel Pint');
  let config = getWorkspaceConfig();

  context.subscriptions.push(commands.registerCommand('laravel-pint.format', () => {
    if (window.activeTextEditor?.document.languageId !== 'php') {
      return;
    }

    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
      format(activeEditorFile, config);
    }
  }));

  context.subscriptions.push(workspace.onDidChangeConfiguration(() => {
    config = getWorkspaceConfig();
  }));

  context.subscriptions.push(workspace.onWillSaveTextDocument((e) => {
    const saveEnabled = config.get<boolean>('formatOnSave');
    
    if (!saveEnabled || e.document.languageId !== 'php') {
      return;
    }
    
    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
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
