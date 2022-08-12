import { spawn } from "node:child_process";
import { platform } from "node:os";

export default class PhpCommand {
  constructor(private cmd: string, private args: Array<string>, private cwd?: string) { }

  run(cwd?: string) {
    if (platform() === "win32") {
      this.args = [this.cmd].concat(this.args);

      // TODO: Fail when no PHP command, check with command-exists package
      this.cmd = 'php';
    }

    const exec = spawn(this.cmd, this.args, {
      cwd: cwd || this.cwd
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