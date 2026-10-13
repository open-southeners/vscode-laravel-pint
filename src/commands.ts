import { window } from "vscode";
import PintEditService from "./PintEditService";
import { isPintDocument } from "./util";

export function formatCommand(pintEditService: PintEditService) {
  const activeTextEditor = window.activeTextEditor;

  if (!activeTextEditor || !isPintDocument(activeTextEditor.document)) {
    return;
  }

  return pintEditService.formatActiveDocument();
}
