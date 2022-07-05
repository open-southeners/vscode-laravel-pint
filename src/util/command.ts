import { existsSync } from "fs";
import path = require("path");
import { window, workspace } from "vscode";
import { CONFIG_FILE_NAME, DEFAULT_EXEC_PATH, DEFAULT_LARAVEL_SAIL_EXEC_PATH } from "../constants";
import { getWorkspaceConfig } from "./misc";
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

export async function buildCommandFromConfig(filePath?: undefined): Promise<Array<string>>;
export async function buildCommandFromConfig(filePath?: string): Promise<false | Array<string>>;
export async function buildCommandFromConfig(filePath?: string) {
  const runInLaravelSail = getWorkspaceConfig<boolean>('runInLaravelSail');
  let commandArgs = await buildLaravelPintExecArgs();

  if (filePath) {
    commandArgs.push(filePath);
  }

  let sailExecutablePath = getWorkspaceConfig<string>('sailExecutablePath', path.posix.join(...DEFAULT_LARAVEL_SAIL_EXEC_PATH));

  if (runInLaravelSail) {
    return commandWithLaravelSail(commandArgs, sailExecutablePath);
  }

  let executableFullPath = getWorkspaceConfig<string>('executablePath', path.posix.join(...DEFAULT_EXEC_PATH));

  if (!await pathExistsInWorkspaceFs(executableFullPath)) {
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

export async function buildLaravelPintExecArgs(): Promise<Array<string>> {
  const executableArgs: Record<string, string> = {};
  const configPath = getWorkspaceConfig<string>('configPath');

  if (!configPath && await pathExistsInWorkspaceFs(asAbsolutePathFromWorkspaceFolder(CONFIG_FILE_NAME))) {
    executableArgs['--config'] = workspace.asRelativePath(CONFIG_FILE_NAME);
  } else if (configPath && await pathExistsInWorkspaceFs(asAbsolutePathFromWorkspaceFolder(configPath))) {
    executableArgs['--config'] = workspace.asRelativePath(configPath);
  }

  const preset = getWorkspaceConfig<PresetOptions>('preset'); 

  if (preset && preset !== 'auto') {
    executableArgs['--preset'] = preset;
  }

  return Object.entries(executableArgs).filter(arg => !!arg[1]).flat();
}