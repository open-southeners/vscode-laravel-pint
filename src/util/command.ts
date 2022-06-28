import { existsSync } from "fs";
import path = require("path");
import { window, workspace, WorkspaceConfiguration } from "vscode";
import { CONFIG_FILE_NAME, DEFAULT_EXEC_PATH, DEFAULT_LARAVEL_SAIL_EXEC_PATH } from "../constants";
import { PresetOptions } from "../types";
import { asAbsolutePathFromWorkspaceFolder, canExecuteFile, pathExistsInWorkspaceFs } from "./filesystem";

function commandWithLaravelSail(args: Array<string>, sailPath?: string) {
  let sailFullPath = sailPath;

  if (!sailFullPath) {
    sailFullPath = path.posix.join(...DEFAULT_LARAVEL_SAIL_EXEC_PATH);
  }

  sailFullPath = asAbsolutePathFromWorkspaceFolder(sailFullPath);

  if (!canExecuteFile(sailFullPath)) {
    existsSync(sailFullPath) && window.showErrorMessage('Executable not readable or lacks permissions for Laravel Sail.');

    return false;
  }

  return [sailPath as string, 'bin', 'pint', ...args];
}

export async function buildCommandFromConfig(filePath: string, config: WorkspaceConfiguration) {
  const runInLaravelSail = config.get<boolean>('runInLaravelSail');
  const commandArgs = [
    filePath,
    ...await buildLaravelPintExecArgs(config)
  ];
  let sailExecutablePath = config.get<string>('sailExecutablePath') || path.posix.join(...DEFAULT_LARAVEL_SAIL_EXEC_PATH);

  if (runInLaravelSail) {
    return commandWithLaravelSail(commandArgs, sailExecutablePath);
  }

  let executableFullPath = config.get<string>('executablePath') || path.posix.join(...DEFAULT_EXEC_PATH);

  if (!pathExistsInWorkspaceFs(executableFullPath)) {
    return false;
  }
  
  if (executableFullPath && !path.isAbsolute(executableFullPath)) {
    executableFullPath = asAbsolutePathFromWorkspaceFolder(executableFullPath);
  }
  
  if (!canExecuteFile(executableFullPath)) {
    existsSync(executableFullPath) && window.showErrorMessage('Executable not readable or lacks permissions for Laravel Pint.');

    return false;
  }

  return [
    executableFullPath,
    ...commandArgs
  ];
}

export async function buildLaravelPintExecArgs(config: WorkspaceConfiguration): Promise<Array<string>> {
  const executableArgs: Record<string, string> = {};
  const configPath = config.get<string>('configPath');

  if (!configPath && await pathExistsInWorkspaceFs(asAbsolutePathFromWorkspaceFolder(CONFIG_FILE_NAME))) {
    executableArgs['--config'] = workspace.asRelativePath(CONFIG_FILE_NAME);
  } else if (configPath && await pathExistsInWorkspaceFs(asAbsolutePathFromWorkspaceFolder(configPath))) {
    executableArgs['--config'] = workspace.asRelativePath(configPath);
  }

  const preset = config.get<PresetOptions>('preset'); 

  if (preset && preset !== 'auto') {
    executableArgs['--preset'] = preset;
  }

  return Object.entries(executableArgs).filter(arg => !!arg[1]).flat();
}