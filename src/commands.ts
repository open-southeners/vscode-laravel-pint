import { window } from "vscode";
import PintEditService from "./PintEditService";

export function formatCommand(pintEditService: PintEditService) {
  const activeTextEditor = window.activeTextEditor;

  if (!activeTextEditor || activeTextEditor.document.languageId !== "php") {
    return;
  }

  return pintEditService.formatActiveDocument();
}
