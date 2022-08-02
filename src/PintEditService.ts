import { Disposable, TextEditor, Uri, workspace, languages, RelativePattern, TextDocument, TextEdit, WorkspaceFolder, window } from "vscode";
import { LoggingService } from "./LoggingService";
import { SOMETHING_WENT_WRONG_FINDING_EXECUTABLE, SOMETHING_WENT_WRONG_FORMATTING } from "./message";
import { ModuleResolver } from "./ModuleResolver";
import { PintEditProvider } from "./PintEditProvider";
import { FormatterStatus, StatusBar } from "./StatusBar";
import { getWorkspaceConfig } from "./util";
const pkg = require('../package.json');

export default class PintEditService implements Disposable {
  private formatterHandler: undefined | Disposable;
  private rangeFormatterHandler: undefined | Disposable;
  private registeredWorkspaces = new Set<string>();

  constructor(
    private moduleResolver: ModuleResolver,
    private loggingService: LoggingService,
    private statusBar: StatusBar
  ) { }

  public registerDisposables(): Disposable[] { 
    const textEditorChange = window.onDidChangeActiveTextEditor(
      this.handleActiveTextEditorChanged
    );

    this.handleActiveTextEditorChanged(window.activeTextEditor);

    return [textEditorChange];
  }
  
  public dispose = () => {
    this.formatterHandler?.dispose();
    this.rangeFormatterHandler?.dispose();
    this.formatterHandler = undefined;
    this.rangeFormatterHandler = undefined;
  };

  private registerDocumentFormatEditorProviders(workspaceFolder: WorkspaceFolder) {
    this.dispose();
    
    const editProvider = new PintEditProvider(this.provideEdits);

    this.formatterHandler = languages.registerDocumentFormattingEditProvider(
      { language: "php", pattern: new RelativePattern(workspaceFolder, '**/*.php') },
      editProvider
    );
  }

  private handleActiveTextEditorChanged = async (
    textEditor: TextEditor | undefined
  ) => {
    if (!textEditor) {
      this.statusBar.hide();
      return;
    }
    const { document } = textEditor;

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      // Do nothing, this is only for registering formatters in workspace folder.
      return;
    }

    const pintCommand = getWorkspaceConfig('runInLaravelSail', false)
      ? await this.moduleResolver.getPintCommandWithinSail(workspaceFolder)
      : await this.moduleResolver.getPintCommand(workspaceFolder);

    // If there isn't an instance here, it is because the module
    // could not be loaded either locally or globally when specified
    if (!pintCommand) {
      this.statusBar.update(FormatterStatus.Error);
      return;
    }

    const isRegistered = this.registeredWorkspaces.has(
      workspaceFolder.uri.fsPath
    );

    if (!isRegistered) {
      this.registerDocumentFormatEditorProviders(workspaceFolder);
      
      this.registeredWorkspaces.add(workspaceFolder.uri.fsPath);

      this.loggingService.logDebug(
        `Enabling Laravel Pint for workspace ${workspaceFolder.uri.fsPath}`
      );
    }

    this.statusBar.update(FormatterStatus.Ready);
  };

  public async formatWorkspaces() {
    const promiseArr: Array<Promise<void>> = [];

    workspace.workspaceFolders?.forEach(workspaceFolder => {
      promiseArr.push(this.formatFile(workspaceFolder.uri));
    });

    Promise.all(promiseArr)
      .catch(() => this.statusBar.update(FormatterStatus.Ready))
      .finally(() => this.statusBar.update(FormatterStatus.Ready));
  }

  public async formatFile(file: Uri) {
    const workspaceFolder = workspace.getWorkspaceFolder(file);

    let command = workspaceFolder
      ? await this.moduleResolver.getPintCommand(workspaceFolder)
      : await this.moduleResolver.getGlobalPintCommand();

    if (!command) {
      this.loggingService.logError(SOMETHING_WENT_WRONG_FINDING_EXECUTABLE + ' ' + pkg.bugs.url);

      return;
    }
    
    this.loggingService.logDebug(
      `Formatting using command "${command.toString()} ${file.fsPath}"`
    );

    // TODO: Output stdout, etc...?
    command.run(workspaceFolder?.uri.fsPath);
  }

  private provideEdits = async (document: TextDocument): Promise<TextEdit[]> => {
    const startTime = new Date().getTime();
    
    await this.formatFile(document.uri);

    const duration = new Date().getTime() - startTime;

    this.loggingService.logInfo(`Formatting completed in ${duration}ms.`);
    
    return [];
  };
}