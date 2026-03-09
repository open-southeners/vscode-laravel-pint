import { spawn } from "node:child_process";
import { platform } from "node:os";
import { workspace } from "vscode";

export interface PhpCommandRunResult {
  args: string[];
  command: string;
  cwd?: string;
  durationMs: number;
  exitCode: number;
  shell: boolean;
  treatedAsSuccess: boolean;
  stderr: string;
  stdout: string;
}

export default class PhpCommand {
  constructor(private cmd: string, private args: Array<string>, private cwd?: string) { }

  private resolveExecution(cwd?: string) {
    let command = this.cmd;
    let args = [...this.args];
    const isWindowsNativeExecutable = /\.(cmd|bat|exe)$/i.test(command);

    if (platform() === "win32" && !isWindowsNativeExecutable) {
      args = [command].concat(args);

      // TODO: Fail when no PHP command, check with command-exists package
      command = workspace.getConfiguration('php.validate').get('executablePath', 'php');
    }

    const shell = platform() === "win32" && /\.(cmd|bat)$/i.test(command);

    return {
      args,
      command,
      cwd: cwd || this.cwd,
      shell
    };
  }

  run(cwd?: string): Promise<PhpCommandRunResult> {
    const execution = this.resolveExecution(cwd);

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const exec = spawn(execution.command, execution.args, {
        cwd: execution.cwd,
        shell: execution.shell
      });

      let stdout = "";
      let stderr = "";

      exec.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      exec.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      exec.on("error", reject);
      exec.on("close", (code) => {
        const trimmedStdout = stdout.trim();
        const trimmedStderr = stderr.trim();
        const treatedAsSuccess = code === 0 || (
          code === 1 &&
          trimmedStderr === "" &&
          /\bFIXED\b/i.test(trimmedStdout)
        );

        const result = {
          ...execution,
          durationMs: Date.now() - startedAt,
          exitCode: code ?? -1,
          treatedAsSuccess,
          stderr: trimmedStderr,
          stdout: trimmedStdout
        };

        if (treatedAsSuccess) {
          resolve(result);
          return;
        }

        const error = new Error(stderr || `Command "${execution.command}" exited with code ${code ?? "unknown"}.`);

        Object.assign(error, { result });

        reject(error);
      });

      exec.stdin.end();
    });
  }

  getExecutionDetails(cwd?: string) {
    return this.resolveExecution(cwd);
  }

  toString() {
    let stringifiedArgs = this.args.filter(Boolean).join(' ');

    if (stringifiedArgs !== '') {
      stringifiedArgs = ` ${stringifiedArgs}`;
    }

    return `${this.cmd}${stringifiedArgs}`;
  }
}
