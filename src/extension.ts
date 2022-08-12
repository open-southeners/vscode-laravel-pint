import { commands, ExtensionContext, workspace } from 'vscode';
import { formatCommand } from './commands';
import { LoggingService } from './LoggingService';
import { ModuleResolver } from './ModuleResolver';
import PintEditService from './PintEditService';
import { StatusBar } from './StatusBar';
import { getWorkspaceConfig, onConfigChange } from './util';

export async function activate(context: ExtensionContext) {
  const loggingService = new LoggingService();

  loggingService.logInfo(`Extension Name: ${context.extension.packageJSON.publisher}.${context.extension.packageJSON.name}.`);
  loggingService.logInfo(`Extension Version: ${context.extension.packageJSON.version}.`);

  if (!context.workspaceState.get<boolean>('laravel-pint.extensionFirstInstall')) {
    workspace.getConfiguration('laravel-pint', { languageId: "php" }).update('enable', true);
    workspace.getConfiguration('editor', { languageId: "php" }).update('formatOnSave', true);

    context.workspaceState.update('laravel-pint.extensionFirstInstall', true);
  }

  if (getWorkspaceConfig('enableDebugLogs')) {
    loggingService.setOutputLevel("DEBUG");
  }

  if (!getWorkspaceConfig('enable')) {
    context.subscriptions.push(onConfigChange(loggingService));

    return;
  }

  const moduleResolver = new ModuleResolver(loggingService);
  const statusBar = new StatusBar();

  const editService = new PintEditService(
    moduleResolver,
    loggingService,
    statusBar
  );

  // Extension commands
  const openOutputCommand = commands.registerCommand(
    "laravel-pint.openOutput",
    () => {
      loggingService.show();
    }
  );

  const formatFileCommand = commands.registerCommand('laravel-pint.format', () => formatCommand(editService));
  const formatProjectCommand = commands.registerCommand('laravel-pint.formatProject', editService.formatWorkspaces);

  context.subscriptions.push(
    editService,
    openOutputCommand,
    formatFileCommand,
    formatProjectCommand,
    ...editService.registerDisposables()
  );
}

export function deactivate() { }
