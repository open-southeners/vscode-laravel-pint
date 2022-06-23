import { accessSync, constants } from "fs";
import path = require("path");
import { window, workspace, WorkspaceConfiguration } from "vscode";

export function getActiveDocumentPath() {
  const activeDocumentUri = window.activeTextEditor?.document.uri;

  if (!activeDocumentUri) {
    return undefined;
  }

  return activeDocumentUri;
}

export function canExecuteFile(file: string) {
  try {
    accessSync(file, constants.X_OK);

    return true;
  } catch (e) {
    return false;
  }
}

export function getWorkspaceRootPath() {
  return workspace.workspaceFolders?.[0].uri.fsPath;
}

export function asAbsolutePathFromWorkspaceFolder(value: string) {
  return path.posix.resolve(getWorkspaceRootPath() || '', value);
}

export function buildExecutableArgsFromConfig(config: WorkspaceConfiguration): Array<string> {
  const configPath = config.get<string>('configPath');

  if (configPath) {
    return ['--config', workspace.asRelativePath(configPath)];
  }

  return Object.entries<string>({
    '--preset': config.get<string>('preset') || ''
  }).filter(arg => !!arg[1]).flat();
}