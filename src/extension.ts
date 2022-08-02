import { commands, ExtensionContext, window } from 'vscode';
import { formatCommand } from './commands';
import { LoggingService } from './LoggingService';
import { ModuleResolver } from './ModuleResolver';
import PintEditService from './PintEditService';
import { StatusBar } from './StatusBar';
import { getWorkspaceConfig } from './util';

// the application insights key (also known as instrumentation key)
const extensionName = process.env.EXTENSION_NAME || "dev.laravel-pint";
const extensionVersion = process.env.EXTENSION_VERSION || "0.0.0";

export async function activate(context: ExtensionContext) {
  const loggingService = new LoggingService();

  if (getWorkspaceConfig('enableDebugLogs', true)) {
    loggingService.setOutputLevel("DEBUG");
  }

  loggingService.logInfo(`Extension Name: ${extensionName}.`);
  loggingService.logInfo(`Extension Version: ${extensionVersion}.`);

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
