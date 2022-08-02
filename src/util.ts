import { accessSync, constants } from "fs";
import path = require("path");
import { RelativePattern, workspace, WorkspaceFolder } from "vscode";
import { ExtensionConfig } from "./types";
import { StringKeyOf } from "type-fest"

type GetFieldType<Obj, Path> = Path extends `${infer Left}.${string}`
  ? Left extends keyof Obj
    ? Obj[Left]
    : undefined
  : Path extends keyof Obj
    ? Obj[Path]
    : undefined

const t:  = "";


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
