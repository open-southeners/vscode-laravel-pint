import fs = require("node:fs/promises");
import {
  Disposable,
  FileSystemWatcher,
  Position,
  Range,
  RelativePattern,
  TextDocument,
  TextEdit,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  WorkspaceFolder,
  languages
} from "vscode";
import { CONFIG_FILE_NAME } from "./constants";
import { LoggingService } from "./LoggingService";
import {
  FORMAT_WORKSPACE_NON_ACTIVE_DOCUMENT,
  RUNNING_PINT_ON_PATH,
  SOMETHING_WENT_WRONG_FINDING_EXECUTABLE,
  UPDATING_EXTENSION_EXCLUDE_PATTERNS
} from "./message";
import { CommandResolver } from "./CommandResolver";
import { PintEditProvider } from "./PintEditProvider";
import { FormatterStatus, StatusBar } from "./StatusBar";
import { getWorkspaceConfig, onConfigChange, resolvePathFromWorkspaces } from "./util";
import CommandRunner, { CommandRunResult } from "./CommandRunner";

const pkg = require('../package.json');

const BASE_EXCLUDED_PATHS = [
  '_ide_helper_actions.php',
  '_ide_helper_models.php',
  '_ide_helper.php',
  '.phpstorm.meta.php',
  '*.blade.php',
  'storage',
  'bootstrap/cache',
  'node_modules',
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

export default class PintEditService implements Disposable {
  private formatterHandler: Disposable | undefined;
  private pintConfigWatchers = new Map<string, FileSystemWatcher>();
  private workspaceExcludedPaths = new Map<string, string[]>();
  private workspaceInitialization = new Map<string, Promise<void>>();

  constructor(
    private commandResolver: CommandResolver,
    private loggingService: LoggingService,
    private statusBar: StatusBar
  ) { }

  public registerDisposables(): Disposable[] {
    const configurationWatcher = onConfigChange(this.loggingService, async () => {
      this.commandResolver.clearCache();
      this.resetWorkspaceState();
      await this.refreshActiveEditorState();
    });

    const formatterSelectors = workspace.workspaceFolders?.map((workspaceFolder) => ({
      language: "php",
      pattern: new RelativePattern(workspaceFolder, '**/*.php')
    })) ?? [{ language: "php", scheme: "file" as const }];

    const formatterHandler = languages.registerDocumentFormattingEditProvider(
      formatterSelectors,
      new PintEditProvider(this.provideEdits)
    );

    const textEditorChange = window.onDidChangeActiveTextEditor(
      this.handleActiveTextEditorChanged
    );

    this.formatterHandler = formatterHandler;
    void this.handleActiveTextEditorChanged(window.activeTextEditor);

    return [configurationWatcher, formatterHandler, textEditorChange];
  }

  public dispose = () => {
    this.formatterHandler?.dispose();
    this.formatterHandler = undefined;
    this.resetWorkspaceState();
  };

  private resetWorkspaceState() {
    for (const watcher of this.pintConfigWatchers.values()) {
      watcher.dispose();
    }

    this.pintConfigWatchers.clear();
    this.workspaceExcludedPaths.clear();
    this.workspaceInitialization.clear();
  }

  private refreshActiveEditorState() {
    return this.handleActiveTextEditorChanged(window.activeTextEditor);
  }

  private async ensureWorkspaceState(workspaceFolder: WorkspaceFolder) {
    const key = workspaceFolder.uri.fsPath;
    const existingInitialization = this.workspaceInitialization.get(key);

    if (existingInitialization) {
      return existingInitialization;
    }

    const initialization = this.initializeWorkspaceState(workspaceFolder)
      .finally(() => {
        this.workspaceInitialization.delete(key);
      });

    this.workspaceInitialization.set(key, initialization);

    return initialization;
  }

  private async initializeWorkspaceState(workspaceFolder: WorkspaceFolder) {
    const key = workspaceFolder.uri.fsPath;

    await this.loadWorkspaceExcludedPaths(workspaceFolder);

    if (this.pintConfigWatchers.has(key)) {
      return;
    }

    const configPattern = getWorkspaceConfig('configPath', CONFIG_FILE_NAME);
    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(workspaceFolder, configPattern)
    );

    const reloadWorkspaceState = async () => {
      this.commandResolver.clearCache();
      await this.loadWorkspaceExcludedPaths(workspaceFolder);
      this.updateStatusBarForDocument(window.activeTextEditor?.document);
    };

    watcher.onDidChange(() => void reloadWorkspaceState());
    watcher.onDidCreate(() => void reloadWorkspaceState());
    watcher.onDidDelete(() => {
      this.commandResolver.clearCache();
      this.workspaceExcludedPaths.set(key, [...BASE_EXCLUDED_PATHS]);
      this.updateStatusBarForDocument(window.activeTextEditor?.document);
    });

    this.pintConfigWatchers.set(key, watcher);
  }

  private async loadWorkspaceExcludedPaths(workspaceFolder: WorkspaceFolder) {
    const key = workspaceFolder.uri.fsPath;
    const configPath = getWorkspaceConfig('configPath', CONFIG_FILE_NAME);
    const configPaths = await resolvePathFromWorkspaces(configPath, workspaceFolder);
    const excludedPaths = [...BASE_EXCLUDED_PATHS];

    if (configPaths.length > 0) {
      try {
        const pintJson = JSON.parse(await fs.readFile(configPaths[0], 'utf8'));

        if (Array.isArray(pintJson.exclude)) {
          excludedPaths.push(...pintJson.exclude.filter((value: unknown): value is string => typeof value === "string"));
        }
      } catch (error) {
        this.loggingService.logWarning('Unable to read Pint configuration excludes.', {
          configPath: configPaths[0],
          workspace: key
        });
        this.loggingService.logDebug('Pint configuration read error.', error);
      }
    }

    const uniqueExcludedPaths = Array.from(new Set(excludedPaths));
    this.workspaceExcludedPaths.set(key, uniqueExcludedPaths);

    this.loggingService.logDebug(UPDATING_EXTENSION_EXCLUDE_PATTERNS, {
      excludedPaths: uniqueExcludedPaths,
      workspace: key
    });
  }

  private handleActiveTextEditorChanged = async (textEditor: typeof window.activeTextEditor) => {
    if (!textEditor) {
      this.statusBar.hide();
      return;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(textEditor.document.uri);

    if (workspaceFolder) {
      await this.ensureWorkspaceState(workspaceFolder);
    }

    this.updateStatusBarForDocument(textEditor.document);
  };

  private updateStatusBarForDocument(document: TextDocument | undefined) {
    if (!document) {
      this.statusBar.hide();
      return;
    }

    const isPhpDocument = document.languageId === "php";
    const documentExcluded = this.isDocumentExcluded(document);

    if (isPhpDocument && !documentExcluded) {
      this.statusBar.update(FormatterStatus.Ready);
      return;
    }

    if (isPhpDocument && documentExcluded) {
      this.statusBar.update(FormatterStatus.Disabled);
      return;
    }

    this.statusBar.hide();
  }

  private getWorkspaceExcludedPaths(documentUri: Uri) {
    const workspaceFolder = workspace.getWorkspaceFolder(documentUri);

    if (!workspaceFolder) {
      return BASE_EXCLUDED_PATHS;
    }

    return this.workspaceExcludedPaths.get(workspaceFolder.uri.fsPath) ?? BASE_EXCLUDED_PATHS;
  }

  private wildcardToRegExp(pattern: string) {
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    return new RegExp(`^${escapedPattern.replace(/\*/g, '.*')}$`);
  }

  private matchesExcludedPath(documentPath: string, excludedPath: string) {
    const normalizedDocumentPath = documentPath.replace(/\\/g, '/');
    const normalizedExcludedPath = excludedPath.replace(/\\/g, '/');
    const parentPath = normalizedDocumentPath.split('/').slice(0, -1).join('/');

    if (normalizedExcludedPath.includes('*')) {
      return this.wildcardToRegExp(normalizedExcludedPath).test(normalizedDocumentPath);
    }

    if (normalizedExcludedPath.includes('/')) {
      return (
        normalizedDocumentPath.endsWith(`/${normalizedExcludedPath}`) ||
        parentPath.endsWith(`/${normalizedExcludedPath}`) ||
        parentPath.includes(`/${normalizedExcludedPath}/`)
      );
    }

    return (
      normalizedDocumentPath.endsWith(`/${normalizedExcludedPath}`) ||
      parentPath.split('/').includes(normalizedExcludedPath)
    );
  }

  private isDocumentExcluded(documentOrUri: TextDocument | Uri) {
    const documentUri = 'uri' in documentOrUri ? documentOrUri.uri : documentOrUri;
    const excludedPaths = this.getWorkspaceExcludedPaths(documentUri);

    return excludedPaths.some((excludedPath) => this.matchesExcludedPath(documentUri.fsPath, excludedPath));
  }

  private async getWorkspaceCommand(
    workspaceFolder: WorkspaceFolder,
    options: { input?: string; isFormatWorkspace?: boolean; stdinFilename?: string } = {}
  ) {
    if (this.isDockerModeEnabled()) {
      return this.commandResolver.getPintCommandWithinDocker(workspaceFolder, options);
    }

    return getWorkspaceConfig('runInLaravelSail', false)
      ? this.commandResolver.getPintCommandWithinSail(workspaceFolder, options)
      : this.commandResolver.getPintCommand(workspaceFolder, options);
  }

  private isDockerModeEnabled() {
    return getWorkspaceConfig('runInDocker', false);
  }

  private logProcessResult(result: CommandRunResult) {
    this.loggingService.logInfo('Pint process finished.', {
      args: result.args,
      command: result.command,
      cwd: result.cwd,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      treatedAsSuccess: result.treatedAsSuccess
    });

    if (result.stdout) {
      this.loggingService.logInfo('Pint stdout:', { output: result.stdout });
    }

    if (result.stderr) {
      this.loggingService.logWarning('Pint stderr:', { output: result.stderr });
    }
  }

  private async runProcess(
    command: CommandRunner,
    label: string,
    context: Record<string, unknown> = {},
    options: {
      input?: string;
      updateStatusBarOnFailure?: boolean;
      updateStatusBarOnSuccess?: boolean;
      successMessage?: string;
    } = {}
  ) {
    const execution = command.getExecutionDetails();

    this.loggingService.logInfo(`Starting ${label}.`, {
      ...context,
      args: execution.args,
      command: execution.command,
      commandLine: command.toString(),
      cwd: execution.cwd,
      shell: execution.shell
    });

    let result: CommandRunResult;

    try {
      result = await command.run(options.input);

      this.logProcessResult(result);
    } catch (error) {
      if (options.updateStatusBarOnFailure ?? true) {
        this.statusBar.update(FormatterStatus.Error);
      }

      const commandResult = error instanceof Error && 'result' in error
        ? (error as Error & { result?: CommandRunResult }).result
        : undefined;

      this.loggingService.logError(`${label} failed: ${command.toString()}`, error);

      if (commandResult) {
        this.loggingService.logError(`${label} process failed.`, {
          ...context,
          args: commandResult.args,
          command: commandResult.command,
          commandLine: command.toString(),
          cwd: commandResult.cwd,
          durationMs: commandResult.durationMs,
          exitCode: commandResult.exitCode,
          stderr: commandResult.stderr,
          stdout: commandResult.stdout
        });
      } else {
        this.loggingService.logError(`${label} process could not start.`, {
          ...context,
          args: execution.args,
          command: execution.command,
          commandLine: command.toString(),
          cwd: execution.cwd,
          shell: execution.shell
        });
      }

      return false;
    }

    if (options.successMessage) {
      this.loggingService.logDebug(options.successMessage, { command: command.toString() });
    }

    if (options.updateStatusBarOnSuccess ?? false) {
      this.statusBar.update(FormatterStatus.Success);
    }

    return result;
  }

  private async runCommand(command: CommandRunner, input?: string, context: Record<string, unknown> = {}) {
    return this.runProcess(command, 'Pint process', context, {
      input,
      successMessage: RUNNING_PINT_ON_PATH,
      updateStatusBarOnFailure: true,
      updateStatusBarOnSuccess: true
    });
  }

  public async formatWorkspace() {
    const activeDocument = window.activeTextEditor?.document;

    if (!activeDocument) {
      this.loggingService.logError(FORMAT_WORKSPACE_NON_ACTIVE_DOCUMENT);
      return;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(activeDocument.uri);

    if (!workspaceFolder) {
      this.loggingService.logError(FORMAT_WORKSPACE_NON_ACTIVE_DOCUMENT);
      return;
    }

    await this.ensureWorkspaceState(workspaceFolder);
    await this.formatFile(workspaceFolder.uri, true);
  }

  public async formatActiveDocument() {
    const activeEditor = window.activeTextEditor;

    if (!activeEditor) {
      return false;
    }

    const edits = await this.provideEdits(activeEditor.document);

    if (edits.length === 0) {
      return true;
    }

    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(activeEditor.document.uri, edits);

    return workspace.applyEdit(workspaceEdit);
  }

  public async formatFile(file: Uri, isFormatWorkspace = false) {
    const filePath = await fs.realpath(file.fsPath);

    if (this.isDocumentExcluded(file)) {
      this.loggingService.logWarning(`The file "${filePath}" is excluded either by you or by Laravel Pint`);
      return false;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(file);

    if (workspaceFolder) {
      await this.ensureWorkspaceState(workspaceFolder);
    }

    const command = workspaceFolder
      ? await this.getWorkspaceCommand(workspaceFolder, { input: filePath, isFormatWorkspace })
      : await this.commandResolver.getGlobalPintCommand([filePath]);

    if (!command) {
      this.statusBar.update(FormatterStatus.Error);
      this.loggingService.logError(SOMETHING_WENT_WRONG_FINDING_EXECUTABLE + ' ' + pkg.bugs.url);
      return false;
    }

    return this.runCommand(command, undefined, {
      input: filePath,
      mode: isFormatWorkspace ? 'workspace' : 'manual',
      workspace: workspaceFolder?.uri.fsPath
    });
  }

  private provideEdits = async (document: TextDocument): Promise<TextEdit[]> => {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return [];
    }

    await this.ensureWorkspaceState(workspaceFolder);

    if (this.isDocumentExcluded(document)) {
      return [];
    }

    const documentText = document.getText();

    this.loggingService.logInfo('Formatting document through Pint stdin.', {
      document: document.uri.fsPath,
      workspace: workspaceFolder.uri.fsPath
    });

    const command = await this.getWorkspaceCommand(workspaceFolder, {
      input: '-',
      stdinFilename: document.uri.fsPath
    });

    if (!command) {
      this.statusBar.update(FormatterStatus.Error);
      this.loggingService.logError(SOMETHING_WENT_WRONG_FINDING_EXECUTABLE + ' ' + pkg.bugs.url);
      return [];
    }

    const result = await this.runCommand(command, documentText, {
      document: document.uri.fsPath,
      mode: 'document',
      workspace: workspaceFolder.uri.fsPath
    });

    if (!result || result.stdout === documentText) {
      return [];
    }

    return [TextEdit.replace(
      new Range(new Position(0, 0), document.positionAt(documentText.length)),
      result.stdout
    )];
  };
}
