import { spawn } from "node:child_process";
import { platform } from "node:os";
import { workspace } from "vscode";

export default class PhpCommand {
  constructor(private cmd: string, private args: Array<string>, private cwd?: string) { }

  run(cwd?: string): Promise<void> {
    let command = this.cmd;
    let args = [...this.args];
    const isWindowsNativeExecutable = /\.(cmd|bat|exe)$/i.test(command);

    if (platform() === "win32" && !isWindowsNativeExecutable) {
      args = [command].concat(args);

      // TODO: Fail when no PHP command, check with command-exists package
      command = workspace.getConfiguration('php.validate').get('executablePath', 'php');
    }

    return new Promise((resolve, reject) => {
      const exec = spawn(command, args, {
        cwd: cwd || this.cwd,
        shell: platform() === "win32" ? true : undefined
      });

      let stderr = "";

      exec.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      exec.on("error", reject);
      exec.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `Command "${command}" exited with code ${code ?? "unknown"}.`));
      });

      exec.stdin.end();
    });
  }

  toString() {
    let stringifiedArgs = this.args.filter(Boolean).join(' ');

    if (stringifiedArgs !== '') {
      stringifiedArgs = ` ${stringifiedArgs}`;
    }

    return `${this.cmd}${stringifiedArgs}`;
  }
}
