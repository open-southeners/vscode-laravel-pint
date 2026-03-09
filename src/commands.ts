import { window } from "vscode";
import PintEditService from "./PintEditService";

export function formatCommand(pintEditService: PintEditService) {
  const activeTextEditorDocumentUri = window.activeTextEditor?.document.uri;

  if (!activeTextEditorDocumentUri) {
    return;
  }

  return pintEditService.formatFile(activeTextEditorDocumentUri);
}
