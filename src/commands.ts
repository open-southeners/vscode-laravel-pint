import { window } from "vscode";
import PintEditService from "./PintEditService";

export function formatCommand(pintEditService: PintEditService) {
  const activeTextEditor = window.activeTextEditor;
  const activeTextEditorDocumentUri = activeTextEditor?.document.uri;

  if (!activeTextEditorDocumentUri) {
    return;
  }

  if (activeTextEditor.document.languageId === "php" && activeTextEditor.document.isDirty) {
    return pintEditService.formatActiveDocument();
  }

  return pintEditService.formatFile(activeTextEditorDocumentUri);
}
