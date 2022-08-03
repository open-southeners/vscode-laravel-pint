import { commands, ExtensionContext } from 'vscode';
import { formatCommand } from './commands';
import { LoggingService } from './LoggingService';
import { ModuleResolver } from './ModuleResolver';
import PintEditService from './PintEditService';
import { StatusBar } from './StatusBar';
import { getWorkspaceConfig, onConfigChange } from './util';
const pkg = require('../package.json');

export async function activate(context: ExtensionContext) {
  const loggingService = new LoggingService();

  loggingService.logInfo(`Extension Name: ${pkg.publisher}.${pkg.name}.`);
  loggingService.logInfo(`Extension Version: ${pkg.version}.`);

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

export function deactivate() {}
