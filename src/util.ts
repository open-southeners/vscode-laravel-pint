import { accessSync, constants } from "fs";
import path = require("path");
import { commands, MessageItem, RelativePattern, window, workspace, WorkspaceFolder } from "vscode";
import { LoggingService } from "./LoggingService";
import { RESTART_TO_ENABLE } from "./message";
import { ExtensionConfig } from "./types";

type GetFieldType<Obj, Path> = Path extends `${infer Left}.${string}`
  ? Left extends keyof Obj
  ? Obj[Left]
  : undefined
  : Path extends keyof Obj
  ? Obj[Path]
  : undefined;

export function getWorkspaceConfig<T = ExtensionConfig, K extends string = Extract<keyof T, string>, R = GetFieldType<T, K>>(key: keyof ExtensionConfig): T | undefined;
export function getWorkspaceConfig<T = ExtensionConfig, K extends string = Extract<keyof T, string>, R = GetFieldType<T, K>>(key: keyof ExtensionConfig, defaultValue: R): R;
export function getWorkspaceConfig<T = ExtensionConfig, K extends string = Extract<keyof T, string>, R = GetFieldType<T, K>>(key: K, defaultValue?: R) {
  const extensionConfig = workspace.getConfiguration('laravel-pint');

  const configByKey = {
    ...extensionConfig.inspect(key),
    value: extensionConfig.get<R>(key),
    hasBeenSet: extensionConfig.has(key)
  };

  if (!configByKey.hasBeenSet || configByKey.defaultValue === configByKey.value) {
    return defaultValue;
  }

  return configByKey.value;
}

export function canExecuteFile(file: string) {
  try {
    accessSync(file, constants.X_OK);

    return true;
  } catch (e) {
    return false;
  }
}

export function isRelativeTo(from: string, to: string) {
  const relative = path.relative(from, to);

  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function resolvePathFromWorkspaces(pattern: string, relativeTo: WorkspaceFolder) {
  const matchedPaths = await workspace.findFiles(
    new RelativePattern(relativeTo, pattern)
  );

  return matchedPaths.map(foundUri => foundUri.fsPath);
}

export function onConfigChange(loggingService: LoggingService) {
  return workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration("laravel-pint.enable")) {
      loggingService.logWarning(RESTART_TO_ENABLE);
  
      const reload: MessageItem = { title: "Reload project" };
      const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
  
      const prompt = await window.showInformationMessage(RESTART_TO_ENABLE, reload, cancel);
  
      if (prompt === reload) {
        commands.executeCommand('workbench.action.reloadWindow');
      }
    }
  })
}
