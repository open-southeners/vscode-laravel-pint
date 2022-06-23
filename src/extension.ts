import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path = require('path');
import { commands, ExtensionContext, OutputChannel, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { asAbsolutePathFromWorkspaceFolder, buildExecutableArgsFromConfig, canExecuteFile, getActiveDocumentPath, getWorkspaceRootPath } from './util';

let outputChannel: OutputChannel | null;

function format(file: Uri, config: WorkspaceConfiguration) {
  let executableFullPath = config.get<string>('executablePath');

  if (executableFullPath && !path.isAbsolute(executableFullPath)) {
    executableFullPath = asAbsolutePathFromWorkspaceFolder(executableFullPath);
  }

  if (!executableFullPath || !existsSync(executableFullPath)) {
    outputChannel?.appendLine(`Executable not found, tried with "${executableFullPath}"...`);
    return;
  }
  
  if (!canExecuteFile(executableFullPath)) {
    return window.showErrorMessage('Executable not readable or lacks permissions for Laravel Pint.');
  }

  const execArgsArr = [
    workspace.asRelativePath(file.path),
    ...buildExecutableArgsFromConfig(config)
  ];
  
  outputChannel?.appendLine(`Formatting file "${workspace.asRelativePath(file.path)}" using command "${executableFullPath} ${execArgsArr.join(' ')}"`);

  const exec = spawn(executableFullPath, execArgsArr, {
    cwd: getWorkspaceRootPath()
  });
}

function getWorkspaceConfig() {
  return workspace.getConfiguration('laravel-pint')
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
    config = getWorkspaceConfig()
  }))

  context.subscriptions.push(workspace.onWillSaveTextDocument((e) => {
    const saveEnabled = config.get<boolean>('formatOnSave')
    
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
