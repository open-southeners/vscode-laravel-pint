import commandExists = require("command-exists");
import { execFileSync, execSync } from "node:child_process";
import { platform } from "node:os";
import path = require("path");
import { workspace, WorkspaceFolder } from "vscode";
import { CONFIG_FILE_NAME, DEFAULT_EXEC_PATH, DEFAULT_LARAVEL_SAIL_EXEC_PATH } from "./constants";
import { LoggingService } from "./LoggingService";
import { CONFIG_PATHS_FOUND_FOR_WORKSPACE, DOCKER_CONFIGURATION_INCOMPLETE, NO_CONFIG_FOUND_FOR_WORKSPACE, PINT_CANNOT_BE_EXECUTED, SAIL_CANNOT_BE_EXECUTED, UNTRUSTED_WORKSPACE_ERROR, UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT } from "./message";
import PhpCommand from "./PhpCommand";
import { canExecuteFile, getWorkspaceConfig, resolvePathFromWorkspaces } from "./util";

export interface DockerExecutionContext {
  containerName: string;
  containerRootPath: string;
  dockerExecutable: string;
  pintExecutablePath: string;
  workspaceRoot: string;
}

export class CommandResolver {
  private globCache = new Map<string, string[]>();

  constructor(private loggingService: LoggingService) { }

  public clearCache() {
    this.globCache.clear();
  }

  private normalizeContainerPath(containerPath: string) {
    const normalizedPath = containerPath.replace(/\\/g, '/');

    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      return normalizedPath.slice(0, -1);
    }

    return normalizedPath;
  }

  private isWorkspacePath(filePath: string, workspaceRoot: string) {
    const relativePath = path.relative(workspaceRoot, filePath);

    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
  }

  private toContainerPath(filePath: string, workspaceRoot: string, containerRoot: string) {
    if (!path.isAbsolute(filePath) || !this.isWorkspacePath(filePath, workspaceRoot)) {
      return filePath;
    }

    const relativePath = path.relative(workspaceRoot, filePath).split(path.sep).join('/');

    return relativePath === ''
      ? containerRoot
      : path.posix.join(containerRoot, relativePath);
  }

  public getDockerExecutionContext(workspaceFolder: WorkspaceFolder): DockerExecutionContext | undefined {
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_ERROR);

      return;
    }

    const dockerExecutable = getWorkspaceConfig('dockerExecutablePath', 'docker');
    const containerName = getWorkspaceConfig('dockerContainerName', '');
    const containerRootPath = getWorkspaceConfig('dockerContainerRootPath', '');

    this.loggingService.logDebug('Resolved Docker configuration.', {
      containerName,
      containerRootPath,
      dockerExecutable,
      path: process.env.PATH,
      workspace: workspaceFolder.uri.fsPath
    });

    if (!dockerExecutable || !containerName || !containerRootPath) {
      this.loggingService.logError(DOCKER_CONFIGURATION_INCOMPLETE, {
        containerName,
        containerRootPath,
        dockerExecutable,
        workspace: workspaceFolder.uri.fsPath
      });

      return;
    }

    const normalizedContainerRoot = this.normalizeContainerPath(containerRootPath);
    const configuredExecutablePath = getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH)).replace(/\\/g, '/');
    const pintExecutablePath = path.posix.isAbsolute(configuredExecutablePath)
      ? configuredExecutablePath
      : path.posix.join(normalizedContainerRoot, configuredExecutablePath);

    return {
      containerName,
      containerRootPath: normalizedContainerRoot,
      dockerExecutable,
      pintExecutablePath,
      workspaceRoot: workspaceFolder.uri.fsPath
    };
  }

  private async resolvePathCached(pattern: string, workspaceFolder: WorkspaceFolder): Promise<string[]> {
    const key = `${workspaceFolder.uri.fsPath}::${pattern}`;

    const cached = this.globCache.get(key);

    if (cached) {
      return cached;
    }

    const result = await resolvePathFromWorkspaces(pattern, workspaceFolder);
    this.globCache.set(key, result);

    return result;
  }

  public async getGlobalPintCommand(args: Array<string>): Promise<PhpCommand> {
    const globalPintPath = await this.resolveGlobalPintPath();

    this.loggingService.logInfo('Resolved global Pint executable.', {
      args,
      executable: globalPintPath
    });

    return new PhpCommand(globalPintPath, args);
  }

  public async getPintCommand(
    workspaceFolder: WorkspaceFolder,
    input?: string,
    isFormatWorkspace = false
  ): Promise<PhpCommand | undefined> {
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT);

      // This doesn't respect fallbackToGlobal config
      return this.getGlobalPintCommand(
        await this.getPintConfigAsArgs(workspaceFolder, input, isFormatWorkspace)
      );
    }

    const executableArr = await this.resolvePathCached(
      '**/' + getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH)),
      workspaceFolder
    );

    const executable = executableArr[0];

    const isExecutable = executable && canExecuteFile(executable);

    const fallbackToGlobal = getWorkspaceConfig('fallbackToGlobalBin') && commandExists.sync('pint');

    this.loggingService.logDebug('Resolved workspace Pint executable candidates.', {
      executable,
      executableCandidates: executableArr,
      fallbackToGlobal,
      input,
      isExecutable,
      workspace: workspaceFolder.uri.fsPath
    });

    if (!isExecutable && fallbackToGlobal) {
      this.loggingService.logInfo('Falling back to global Pint executable.', {
        input,
        requestedExecutable: getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH)),
        workspace: workspaceFolder.uri.fsPath
      });

      return this.getGlobalPintCommand(
        await this.getPintConfigAsArgs(workspaceFolder, input, isFormatWorkspace)
      );
    }

    if (!isExecutable && !fallbackToGlobal) {
      this.loggingService.logError(PINT_CANNOT_BE_EXECUTED);

      return;
    }

    const cmd = getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH));

    const cwd = path.normalize(executable).replace(path.normalize(cmd), '');

    this.loggingService.logInfo('Resolved workspace Pint command.', {
      cwd,
      executable,
      input,
      requestedCommand: cmd,
      workspace: workspaceFolder.uri.fsPath
    });

    return new PhpCommand(
      cmd,
      await this.getPintConfigAsArgs(workspaceFolder, input, isFormatWorkspace),
      cwd
    );
  }

  private async resolveGlobalPintPath() {
    await commandExists('pint');

    if (platform() === "win32") {
      const output = execFileSync('where', ['pint'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const resolvedPath = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

      if (resolvedPath) {
        return resolvedPath;
      }
    }

    const output = execSync('command -v pint', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    return output || 'pint';
  }

  public async getPintCommandWithinSail(
    workspaceFolder: WorkspaceFolder,
    input?: string,
    isFormatWorkspace = false
  ): Promise<PhpCommand | undefined> {
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_ERROR);

      return;
    }

    const executableArr = await this.resolvePathCached(
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

    const args = await this.getPintConfigAsArgs(workspaceFolder, input, isFormatWorkspace);
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Convert absolute host paths to workspace-relative for container access
    const containerArgs = args.map(arg => {
      if (path.isAbsolute(arg) && arg.startsWith(workspaceRoot)) {
        return path.relative(workspaceRoot, arg);
      }
      return arg;
    });

    this.loggingService.logInfo('Resolved Laravel Sail Pint command.', {
      args: containerArgs,
      executable,
      input,
      workspace: workspaceRoot
    });

    return new PhpCommand(
      executable,
      ['bin', 'pint', ...containerArgs],
      workspaceRoot
    );
  }

  public async getPintCommandWithinDocker(
    workspaceFolder: WorkspaceFolder,
    input?: string,
    isFormatWorkspace = false
  ): Promise<PhpCommand | undefined> {
    const dockerContext = this.getDockerExecutionContext(workspaceFolder);

    if (!dockerContext) {
      return;
    }

    const args = await this.getPintConfigAsArgs(workspaceFolder, input, isFormatWorkspace);
    const containerArgs = args.map((arg) => this.toContainerPath(arg, dockerContext.workspaceRoot, dockerContext.containerRootPath));

    this.loggingService.logInfo('Resolved Docker Pint command.', {
      args: containerArgs,
      containerName: dockerContext.containerName,
      containerRootPath: dockerContext.containerRootPath,
      dockerExecutable: dockerContext.dockerExecutable,
      executable: dockerContext.pintExecutablePath,
      input,
      workspace: dockerContext.workspaceRoot
    });

    return new PhpCommand(
      dockerContext.dockerExecutable,
      ['exec', '-w', dockerContext.containerRootPath, dockerContext.containerName, dockerContext.pintExecutablePath, ...containerArgs],
      dockerContext.workspaceRoot,
      { executionMode: 'native' }
    );
  }

  private async getPintConfigAsArgs(
    workspaceFolder: WorkspaceFolder,
    input?: string,
    isFormatWorkspace = false
  ) {
    const executableArgs: Record<string, string> = {};
    const configPath = getWorkspaceConfig('configPath', CONFIG_FILE_NAME);

    const matchedPaths = await this.resolvePathCached(configPath, workspaceFolder);

    if (matchedPaths.length !== 0) {
      this.loggingService.logDebug(CONFIG_PATHS_FOUND_FOR_WORKSPACE, { workspace: workspaceFolder.uri.fsPath, found: matchedPaths });

      executableArgs['--config'] = matchedPaths[0];
    } else {
      this.loggingService.logDebug(NO_CONFIG_FOUND_FOR_WORKSPACE, workspaceFolder.uri.fsPath);
    }

    const preset = getWorkspaceConfig('preset', 'auto');

    if (preset && preset !== 'auto') {
      executableArgs['--preset'] = preset;
    }

    const executableArgsAsArray = Object.entries(executableArgs).filter(arg => !!arg[1]).flat();

    executableArgsAsArray.push(input || workspaceFolder.uri.fsPath);

    if (isFormatWorkspace) {
      const dirtyOnly = getWorkspaceConfig("dirtyOnly", false);
      if (dirtyOnly) {
        executableArgsAsArray.push("--dirty");
      }
    }

    executableArgsAsArray.push('--repair');

    return executableArgsAsArray;
  }
}
