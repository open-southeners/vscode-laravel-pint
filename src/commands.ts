import { window } from "vscode";
import PintEditService from "./PintEditService";

export async function formatCommand(pintEditService: PintEditService) {
  const activeTextEditorDocumentUri = window.activeTextEditor?.document.uri;

  if (!activeTextEditorDocumentUri) {
    return;
  }

  return await pintEditService.formatFile(activeTextEditorDocumentUri);
}
