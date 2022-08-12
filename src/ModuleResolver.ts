import commandExists = require("command-exists");
import path = require("path");
import { workspace, WorkspaceFolder } from "vscode";
import { CONFIG_FILE_NAME, DEFAULT_EXEC_PATH, DEFAULT_LARAVEL_SAIL_EXEC_PATH } from "./constants";
import { LoggingService } from "./LoggingService";
import { CONFIG_PATHS_FOUND_FOR_WORKSPACE, NO_CONFIG_FOUND_FOR_WORKSPACE, PINT_CANNOT_BE_EXECUTED, SAIL_CANNOT_BE_EXECUTED, UNTRUSTED_WORKSPACE_ERROR, UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT } from "./message";
import PhpCommand from "./PhpCommand";
import { canExecuteFile, getWorkspaceConfig, resolvePathFromWorkspaces } from "./util";

export class ModuleResolver {
  constructor(private loggingService: LoggingService) { }

  public async getGlobalPintCommand(): Promise<PhpCommand> {
    const globalPintPath = await commandExists('pint');

    return new PhpCommand(globalPintPath, []);
  }

  public async getPintCommand(workspaceFolder: WorkspaceFolder): Promise<PhpCommand | undefined> {
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT);

      // This doesn't respect fallbackToGlobal config
      return this.getGlobalPintCommand();
    }

    const executableArr = await resolvePathFromWorkspaces(
      '**/' + getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH)),
      workspaceFolder
    );

    if (executableArr.length === 0) {
      this.loggingService.logError(PINT_CANNOT_BE_EXECUTED);

      return;
    }

    const executable = executableArr[0];

    const isExecutable = canExecuteFile(executable);

    const fallbackToGlobal = getWorkspaceConfig('fallbackToGlobalBin') && commandExists.sync('pint');

    if (!isExecutable && fallbackToGlobal) {
      return this.getGlobalPintCommand();
    }

    if (!isExecutable && !fallbackToGlobal) {
      this.loggingService.logError(PINT_CANNOT_BE_EXECUTED);

      return;
    }

    return new PhpCommand(executable, await this.getPintConfigAsArgs(workspaceFolder));
  }

  public async getPintCommandWithinSail(workspaceFolder: WorkspaceFolder): Promise<PhpCommand | undefined> {
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_ERROR);

      return;
    }

    const executableArr = await resolvePathFromWorkspaces(
      '**/' + getWorkspaceConfig('sailExecutablePath', path.posix.join(...DEFAULT_LARAVEL_SAIL_EXEC_PATH)),
      workspaceFolder
    );

    if (executableArr.length === 0) {
      this.loggingService.logError(SAIL_CANNOT_BE_EXECUTED);

      return;
    }

    const executable = executableArr[0];

    if (!canExecuteFile(executable)) {
      this.loggingService.logError(SAIL_CANNOT_BE_EXECUTED);

      return;
    }

    return new PhpCommand(executable, ['bin', 'pint', ...await this.getPintConfigAsArgs(workspaceFolder)]);
  }

  private async getPintConfigAsArgs(workspaceFolder: WorkspaceFolder) {
    const executableArgs: Record<string, string> = {};
    const configPath = getWorkspaceConfig('configPath', CONFIG_FILE_NAME);

    const matchedPaths = await resolvePathFromWorkspaces(configPath, workspaceFolder);

    if (matchedPaths.length !== 0) {
      this.loggingService.logDebug(CONFIG_PATHS_FOUND_FOR_WORKSPACE, { workspace: workspaceFolder.uri.fsPath, found: matchedPaths });

      executableArgs['--config'] = workspace.asRelativePath(matchedPaths[0]);
    } else {
      this.loggingService.logDebug(NO_CONFIG_FOUND_FOR_WORKSPACE, workspaceFolder.uri.fsPath);
    }

    const preset = getWorkspaceConfig('preset', 'auto');

    if (preset && preset !== 'auto') {
      executableArgs['--preset'] = preset;
    }

    return Object.entries(executableArgs).filter(arg => !!arg[1]).flat();
  }
}