import { accessSync, constants } from "fs";
import path = require("path");
import { FilePermission, Uri, window, workspace } from "vscode";

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

export function pathToUri(uri: string | Uri) {
  if (typeof uri === 'object') {
    return uri;
  }

  return Uri.file(uri);
}

export async function pathExistsInWorkspaceFs(maybeUri: string | Uri) {
  try {
    await workspace.fs.stat(pathToUri(maybeUri));

    FilePermission;

    return true;
  } catch (e) {
    return false;
  }
}