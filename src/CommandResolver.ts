import commandExists = require("command-exists");
import { execFileSync, execSync } from "node:child_process";
import { platform } from "node:os";
import path = require("path");
import { workspace, WorkspaceFolder } from "vscode";
import { CONFIG_FILE_NAME, DEFAULT_EXEC_PATH, DEFAULT_LARAVEL_SAIL_EXEC_PATH } from "./constants";
import { LoggingService } from "./LoggingService";
import { CONFIG_PATHS_FOUND_FOR_WORKSPACE, DOCKER_CONFIGURATION_INCOMPLETE, NO_CONFIG_FOUND_FOR_WORKSPACE, PINT_CANNOT_BE_EXECUTED, SAIL_CANNOT_BE_EXECUTED, UNTRUSTED_WORKSPACE_ERROR, UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT } from "./message";
import CommandRunner from "./CommandRunner";
import { canExecuteFile, getWorkspaceConfig, resolvePathFromWorkspaces } from "./util";

export interface DockerExecutionContext {
  containerName: string;
  containerRootPath: string;
  dockerExecutable: string;
  pintExecutablePath: string;
  workspaceRoot: string;
}

export interface PintCommandOptions {
  args?: string[];
  blade?: boolean;
  input?: string;
  isFormatWorkspace?: boolean;
  stdinFilename?: string;
}

export class CommandResolver {
  private bladeSupportCache = new Map<string, Promise<boolean>>();
  private globCache = new Map<string, string[]>();

  constructor(private loggingService: LoggingService) { }

  public clearCache() {
    this.bladeSupportCache.clear();
    this.globCache.clear();
  }

  public supportsBladeFormatting(workspaceFolder: WorkspaceFolder): Promise<boolean> {
    const key = workspaceFolder.uri.fsPath;
    const cached = this.bladeSupportCache.get(key);

    if (cached) {
      return cached;
    }

    const detection = this.detectBladeFormattingSupport(workspaceFolder);
    this.bladeSupportCache.set(key, detection);

    return detection;
  }

  private async detectBladeFormattingSupport(workspaceFolder: WorkspaceFolder) {
    try {
      const options: PintCommandOptions = { args: ['--help'] };
      const command = getWorkspaceConfig('runInDocker', false, workspaceFolder.uri)
        ? await this.getPintCommandWithinDocker(workspaceFolder, options)
        : getWorkspaceConfig('runInLaravelSail', false, workspaceFolder.uri)
          ? await this.getPintCommandWithinSail(workspaceFolder, options)
          : await this.getPintCommand(workspaceFolder, options);

      if (!command) {
        return false;
      }

      const result = await command.run();
      const supported = /(^|\s)--blade(?:\s|$)/m.test(`${result.stdout}\n${result.stderr}`);

      this.loggingService.logDebug('Detected Pint Blade formatting support.', {
        supported,
        workspace: workspaceFolder.uri.fsPath
      });

      return supported;
    } catch (error) {
      this.loggingService.logWarning('Unable to detect Pint Blade formatting support.', {
        workspace: workspaceFolder.uri.fsPath
      });
      this.loggingService.logDebug('Pint Blade support detection error.', error);

      return false;
    }
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

    const dockerExecutable = getWorkspaceConfig('dockerExecutablePath', 'docker', workspaceFolder.uri);
    const containerName = getWorkspaceConfig('dockerContainerName', '', workspaceFolder.uri);
    const containerRootPath = getWorkspaceConfig('dockerContainerRootPath', '', workspaceFolder.uri);

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
    const configuredExecutablePath = getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH), workspaceFolder.uri).replace(/\\/g, '/');
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

  public async getGlobalPintCommand(args: Array<string>): Promise<CommandRunner> {
    const globalPintPath = await this.resolveGlobalPintPath();

    this.loggingService.logInfo('Resolved global Pint executable.', {
      args,
      executable: globalPintPath
    });

    return CommandRunner.phpScript(globalPintPath, args);
  }

  public async getPintCommand(
    workspaceFolder: WorkspaceFolder,
    options: PintCommandOptions = {}
  ): Promise<CommandRunner | undefined> {
    const { args, input } = options;
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_USING_GLOBAL_PINT);

      // This doesn't respect fallbackToGlobal config
      return this.getGlobalPintCommand(
        args ?? await this.getPintConfigAsArgs(workspaceFolder, options)
      );
    }

    const executableArr = await this.resolvePathCached(
      '**/' + getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH), workspaceFolder.uri),
      workspaceFolder
    );

    const executable = executableArr[0];

    const isExecutable = executable && canExecuteFile(executable);

    const fallbackToGlobal = getWorkspaceConfig('fallbackToGlobalBin', false, workspaceFolder.uri) && commandExists.sync('pint');

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
        requestedExecutable: getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH), workspaceFolder.uri),
        workspace: workspaceFolder.uri.fsPath
      });

      return this.getGlobalPintCommand(
        args ?? await this.getPintConfigAsArgs(workspaceFolder, options)
      );
    }

    if (!isExecutable && !fallbackToGlobal) {
      this.loggingService.logError(PINT_CANNOT_BE_EXECUTED);

      return;
    }

    const cmd = getWorkspaceConfig('executablePath', path.posix.join(...DEFAULT_EXEC_PATH), workspaceFolder.uri);

    const cwd = path.normalize(executable).replace(path.normalize(cmd), '');

    this.loggingService.logInfo('Resolved workspace Pint command.', {
      cwd,
      executable,
      input,
      requestedCommand: cmd,
      workspace: workspaceFolder.uri.fsPath
    });

    return CommandRunner.phpScript(
      cmd,
      args ?? await this.getPintConfigAsArgs(workspaceFolder, options),
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
    options: PintCommandOptions = {}
  ): Promise<CommandRunner | undefined> {
    const { args: commandArgs, input } = options;
    if (!workspace.isTrusted) {
      this.loggingService.logDebug(UNTRUSTED_WORKSPACE_ERROR);

      return;
    }

    const executableArr = await this.resolvePathCached(
      '**/' + getWorkspaceConfig('sailExecutablePath', path.posix.join(...DEFAULT_LARAVEL_SAIL_EXEC_PATH), workspaceFolder.uri),
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

    const args = commandArgs ?? await this.getPintConfigAsArgs(workspaceFolder, options);
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

    return CommandRunner.phpScript(
      executable,
      ['bin', 'pint', ...containerArgs],
      workspaceRoot
    );
  }

  public async getPintCommandWithinDocker(
    workspaceFolder: WorkspaceFolder,
    options: PintCommandOptions = {}
  ): Promise<CommandRunner | undefined> {
    const { args: commandArgs, input, stdinFilename } = options;
    const dockerContext = this.getDockerExecutionContext(workspaceFolder);

    if (!dockerContext) {
      return;
    }

    const args = commandArgs ?? await this.getPintConfigAsArgs(workspaceFolder, options);
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

    return CommandRunner.native(
      dockerContext.dockerExecutable,
      ['exec', ...(stdinFilename ? ['-i'] : []), '-w', dockerContext.containerRootPath, dockerContext.containerName, dockerContext.pintExecutablePath, ...containerArgs],
      dockerContext.workspaceRoot
    );
  }

  private async getPintConfigAsArgs(workspaceFolder: WorkspaceFolder, options: PintCommandOptions = {}) {
    const { blade = false, input, isFormatWorkspace = false, stdinFilename } = options;
    const executableArgs: Record<string, string> = {};
    const configPath = getWorkspaceConfig('configPath', CONFIG_FILE_NAME, workspaceFolder.uri);

    const matchedPaths = await this.resolvePathCached(configPath, workspaceFolder);

    if (matchedPaths.length !== 0) {
      this.loggingService.logDebug(CONFIG_PATHS_FOUND_FOR_WORKSPACE, { workspace: workspaceFolder.uri.fsPath, found: matchedPaths });

      executableArgs['--config'] = matchedPaths[0];
    } else {
      this.loggingService.logDebug(NO_CONFIG_FOUND_FOR_WORKSPACE, workspaceFolder.uri.fsPath);
    }

    const preset = getWorkspaceConfig('preset', 'auto', workspaceFolder.uri);

    if (preset && preset !== 'auto') {
      executableArgs['--preset'] = preset;
    }

    const executableArgsAsArray = Object.entries(executableArgs).filter(arg => !!arg[1]).flat();

    if (blade) {
      executableArgsAsArray.push('--blade');
    }

    executableArgsAsArray.push(input || workspaceFolder.uri.fsPath);

    if (stdinFilename) {
      executableArgsAsArray.push('--stdin-filename', stdinFilename);
    }

    if (isFormatWorkspace) {
      const dirtyOnly = getWorkspaceConfig("dirtyOnly", false, workspaceFolder.uri);
      if (dirtyOnly) {
        executableArgsAsArray.push("--dirty");
      }
    }

    executableArgsAsArray.push('--repair');

    return executableArgsAsArray;
  }
}
