import {
  CancellationToken,
  DocumentFormattingEditProvider,
  FormattingOptions,
  TextDocument,
  TextEdit,
} from "vscode";
import { ExtensionFormattingOptions } from "./types";

export class PintEditProvider implements DocumentFormattingEditProvider
{
  constructor(
    private provideEdits: (
      document: TextDocument,
      options: ExtensionFormattingOptions
    ) => Promise<TextEdit[]>
  ) {}

  public async provideDocumentFormattingEdits(
    document: TextDocument,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: FormattingOptions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken
  ): Promise<TextEdit[]> {
    return this.provideEdits(document, {
      force: false,
    });
  }
}