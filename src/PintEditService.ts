import { readFile } from "fs-extra";
import { Disposable, TextEditor, Uri, workspace, languages, RelativePattern, TextDocument, TextEdit, WorkspaceFolder, window, FileSystemWatcher } from "vscode";
import { LoggingService } from "./LoggingService";
import { SOMETHING_WENT_WRONG_FINDING_EXECUTABLE } from "./message";
import { ModuleResolver } from "./ModuleResolver";
import { PintEditProvider } from "./PintEditProvider";
import { FormatterStatus, StatusBar } from "./StatusBar";
import { getWorkspaceConfig, onConfigChange } from "./util";
const pkg = require('../package.json');

export default class PintEditService implements Disposable {
  private formatterHandler: undefined | Disposable;
  // TODO: Don't know if this can be done with Laravel Pint...
  private rangeFormatterHandler: undefined | Disposable;
  private registeredWorkspaces = new Set<string>();
  private pintConfigWatcher: undefined | FileSystemWatcher;
  private excludedPaths: Array<string> = [
    // Extracted from the preset of excludes of Laravel Pint
    '_ide_helper_actions.php',
    '_ide_helper_models.php',
    '_ide_helper.php',
    '.phpstorm.meta.php',
    '*.blade.php',
    'storage',
    'bootstrap/cache',
    'node_modules',
    // Extracted from the ignoreVCS part of Symfony's Finder
    '.svn',
    '_svn',
    'CVS',
    '_darcs',
    '.arch-params',
    '.monotone',
    '.bzr',
    '.git',
    '.hg'
  ];

  constructor(
    private moduleResolver: ModuleResolver,
    private loggingService: LoggingService,
    private statusBar: StatusBar
  ) { }

  public registerDisposables(): Disposable[] {
    const configurationWatcher = onConfigChange(this.loggingService);

    const textEditorChange = window.onDidChangeActiveTextEditor(
      this.handleActiveTextEditorChanged
    );

    this.handleActiveTextEditorChanged(window.activeTextEditor);

    return [configurationWatcher, textEditorChange];
  }
  
  public dispose = () => {
    this.formatterHandler?.dispose();
    this.rangeFormatterHandler?.dispose();
    this.pintConfigWatcher?.dispose();
    this.formatterHandler = undefined;
    this.rangeFormatterHandler = undefined;
    this.pintConfigWatcher = undefined;
  };

  private async registerDocumentFormatEditorProviders(workspaceFolder: WorkspaceFolder) {
    this.dispose();
    
    const editProvider = new PintEditProvider(this.provideEdits);

    this.formatterHandler = languages.registerDocumentFormattingEditProvider(
      { language: "php", pattern: new RelativePattern(workspaceFolder, '**/*.php') },
      editProvider
    );

    const pintConfigWorkspaceRelativePattern = new RelativePattern(workspaceFolder, 'pint.json');
    this.pintConfigWatcher = workspace.createFileSystemWatcher(pintConfigWorkspaceRelativePattern);
    
    // We need to watch & run this function after watcher added
    let pintConfigChanged;

    this.pintConfigWatcher.onDidChange(pintConfigChanged = async (e: Uri) => {
      const pintJson = JSON.parse(await readFile(e.fsPath, 'utf8'));

      if ('exclude' in pintJson && typeof pintJson.exclude === "object") {
        this.excludedPaths = this.excludedPaths.concat(pintJson.exclude);

        this.loggingService.logDebug('Pint JSON config file got updated with new excludes, updating the extension ones...', this.excludedPaths);
      }
    })

    const workspacePintConfigFilesFound = await workspace.findFiles(pintConfigWorkspaceRelativePattern);

    if (workspacePintConfigFilesFound.length > 0) {
      pintConfigChanged(workspacePintConfigFilesFound[0]);
    }
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
      await this.registerDocumentFormatEditorProviders(workspaceFolder);
      
      this.registeredWorkspaces.add(workspaceFolder.uri.fsPath);

      this.loggingService.logDebug(
        `Enabling Laravel Pint for workspace ${workspaceFolder.uri.fsPath}`
      );
    }

    const matchedDocumentLanguage = languages.match({ language: "php" }, document);
    const documentExcluded = this.isDocumentExcluded(document)

    if (matchedDocumentLanguage > 0 && !documentExcluded) {
      this.statusBar.update(FormatterStatus.Ready);
    } else {
      documentExcluded ? this.statusBar.update(FormatterStatus.Disabled) : this.statusBar.hide();
    }
  };

  private isDocumentExcluded(documentOrUri: TextDocument | Uri) {
    const documentPath = 'uri' in documentOrUri ? documentOrUri.uri.fsPath : documentOrUri.fsPath;

    return this.excludedPaths.filter(excludedPath => 
      documentPath.endsWith(excludedPath) || documentPath.split('/').slice(0, -1).join('/').includes(excludedPath)
    ).length > 0;
  }

  public async formatWorkspaces() {
    const promiseArr: Array<Promise<boolean>> = [];

    workspace.workspaceFolders?.forEach(workspaceFolder => {
      promiseArr.push(this.formatFile(workspaceFolder.uri));
    });

    Promise.all(promiseArr)
      .catch(() => this.statusBar.update(FormatterStatus.Ready))
      .finally(() => this.statusBar.update(FormatterStatus.Ready));
  }

  public async formatFile(file: Uri) {
    if (this.isDocumentExcluded(file)) {
      this.loggingService.logWarning(`The file "${file.fsPath}" is excluded either by you or by Laravel Pint`);

      return false;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(file);

    let command = workspaceFolder
      ? await this.moduleResolver.getPintCommand(workspaceFolder)
      : await this.moduleResolver.getGlobalPintCommand();

    if (!command) {
      this.statusBar.update(FormatterStatus.Error);

      this.loggingService.logError(SOMETHING_WENT_WRONG_FINDING_EXECUTABLE + ' ' + pkg.bugs.url);

      return false;
    }
    
    // TODO: Output stdout, etc...?
    command.run(workspaceFolder?.uri.fsPath);
    
    this.loggingService.logDebug(
      `Formatting using command "${command.toString()} ${file.fsPath}"`
    );

    this.statusBar.update(FormatterStatus.Success);

    return true;
  }

  private provideEdits = async (document: TextDocument): Promise<TextEdit[]> => {
    const startTime = new Date().getTime();
    
    const result = await this.formatFile(document.uri);

    if (!result) {
      return [];
    }

    const duration = new Date().getTime() - startTime;

    this.loggingService.logInfo(`Formatting completed in ${duration}ms.`);
    
    return [];
  };
}