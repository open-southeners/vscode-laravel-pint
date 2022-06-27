import { accessSync, constants, existsSync } from "fs";
import path = require("path");
import { window, workspace, WorkspaceConfiguration } from "vscode";
import { CONFIG_FILE_NAME } from "./constants";

export type PresetOptions = 'auto' | 'laravel' | 'psr-12' | 'symfony';

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
  const executableArgs: Record<string, string> = {};
  const configPath = config.get<string>('configPath');
  
  console.log(asAbsolutePathFromWorkspaceFolder(CONFIG_FILE_NAME))

  if (!configPath && existsSync(asAbsolutePathFromWorkspaceFolder(CONFIG_FILE_NAME))) {
    executableArgs['--config'] = workspace.asRelativePath(CONFIG_FILE_NAME);
  } else if (configPath && existsSync(asAbsolutePathFromWorkspaceFolder(configPath))) {
    executableArgs['--config'] = workspace.asRelativePath(configPath);
  }

  const preset = config.get<PresetOptions>('preset'); 

  if (preset && preset !== 'auto') {
    executableArgs['--preset'] = preset;
  }

  return Object.entries(executableArgs).filter(arg => !!arg[1]).flat();
}