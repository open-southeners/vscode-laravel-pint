import { spawn } from 'child_process';
import { commands, ExtensionContext, tasks, Uri, window, workspace } from 'vscode';
import { getFormatTasks, PintTaskProvider } from './pintTaskProvider';
import { buildCommandFromConfig, getActiveDocumentPath, getOutputChannel, getWorkspaceConfig, getWorkspaceRootPath } from './util';
const pkg = require('../package.json');

async function format(file: Uri) {
  const filePath = workspace.asRelativePath(file.path);
  let command: string | undefined;
  const commandParts = await buildCommandFromConfig(filePath);

  if (commandParts === false || !(command = commandParts.shift())) {
    getOutputChannel().appendLine(`Something went wrong! Executable does not exists or lacks permissions. Please check before create an issue on ${pkg.bugs.url}`);

    return;
  }
  
  getOutputChannel().appendLine(
    (filePath ? `Formatting file "${filePath}"` : 'Formatting workspace folder') + ` using command "${command} ${commandParts.join(' ')}"`
  );

  // TODO: Output stdout, etc...?
  const exec = spawn(command, commandParts, {
    cwd: getWorkspaceRootPath()
  });
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('laravel-pint.format', () => {
    if (window.activeTextEditor?.document.languageId !== 'php') {
      return;
    }

    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
      format(activeEditorFile);
    }
  }));

  context.subscriptions.push(commands.registerCommand('laravel-pint.formatProject', async () => {
    const extensionTasks = await getFormatTasks();
    
    tasks.executeTask(extensionTasks[0]);
  }));

  context.subscriptions.push(tasks.registerTaskProvider(PintTaskProvider.PintType, new PintTaskProvider));

  context.subscriptions.push(workspace.onWillSaveTextDocument((e) => {
    const saveEnabled = getWorkspaceConfig<boolean>('formatOnSave');
    
    if (!saveEnabled || e.document.languageId !== 'php') {
      return;
    }
    
    const activeEditorFile = getActiveDocumentPath();

    if (activeEditorFile) {
      format(activeEditorFile);
    }
  }));
}

export function deactivate() {
  getOutputChannel(true);
}
