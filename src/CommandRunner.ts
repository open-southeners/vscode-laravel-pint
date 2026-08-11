import { spawn } from "node:child_process";
import { platform } from "node:os";
import { workspace } from "vscode";

export interface CommandSpec {
  args: string[];
  command: string;
  cwd?: string;
  shell: boolean;
}

export interface CommandRunResult extends CommandSpec {
  durationMs: number;
  exitCode: number;
  treatedAsSuccess: boolean;
  stderr: string;
  stdout: string;
}

/** Runs every Pint invocation after its platform-specific command has been resolved. */
export default class CommandRunner {
  constructor(private spec: CommandSpec) { }

  public static phpScript(script: string, args: string[], cwd?: string): CommandRunner {
    if (platform() !== 'win32') {
      return new CommandRunner({ command: script, args, cwd, shell: false });
    }

    // Composer/global installations may resolve Pint itself to a native Windows
    // launcher. In that case PHP must not be inserted before the command.
    if (/\.(cmd|bat|exe)$/i.test(script)) {
      return CommandRunner.native(script, args, cwd);
    }

    // VS Code's PHP extension declares this setting with a null default. `get` can
    // therefore return null instead of the fallback supplied as its second argument.
    const configuredPhp = workspace
      .getConfiguration('php.validate')
      .get<string | null>('executablePath');
    const phpExecutable = configuredPhp?.trim() || 'php';

    return new CommandRunner({
      command: phpExecutable,
      args: [script, ...args],
      cwd,
      shell: /\.(cmd|bat)$/i.test(phpExecutable)
    });
  }

  public static native(command: string, args: string[], cwd?: string): CommandRunner {
    return new CommandRunner({
      command,
      args,
      cwd,
      shell: platform() === 'win32' && /\.(cmd|bat)$/i.test(command)
    });
  }

  public getExecutionDetails(): CommandSpec {
    return { ...this.spec, args: [...this.spec.args] };
  }

  public run(input?: string): Promise<CommandRunResult> {
    const execution = this.getExecutionDetails();

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const exec = spawn(execution.command, execution.args, {
        cwd: execution.cwd,
        shell: execution.shell
      });

      let stdout = '';
      let stderr = '';

      exec.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      exec.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      exec.on('error', reject);
      exec.on('close', (code) => {
        const trimmedStdout = stdout.trim();
        const trimmedStderr = stderr.trim();
        const treatedAsSuccess = code === 0 || (
          code === 1 && trimmedStderr === '' && /\bFIXED\b/i.test(trimmedStdout)
        );
        const result: CommandRunResult = {
          ...execution,
          durationMs: Date.now() - startedAt,
          exitCode: code ?? -1,
          treatedAsSuccess,
          stderr,
          stdout
        };

        if (treatedAsSuccess) {
          resolve(result);
          return;
        }

        const error = new Error(stderr || `Command "${execution.command}" exited with code ${code ?? 'unknown'}.`);
        Object.assign(error, { result });
        reject(error);
      });

      exec.stdin.end(input);
    });
  }

  public toString() {
    return [this.spec.command, ...this.spec.args].join(' ');
  }
}
