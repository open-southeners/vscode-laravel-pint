import { spawn } from "child_process";

export default class PhpCommand {
  constructor(private cmd: string, private args: Array<string>, private cwd?: string) {}

  run(cwd?: string) {
    let cmd = this.cmd;

    if (process.platform === "win32") {
      this.args.push(this.cmd);

      this.cmd = 'php';
    }

    const exec = spawn(cmd, this.args, {
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