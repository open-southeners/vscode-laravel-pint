import { OutputChannel, window, workspace } from "vscode";

let outputChannel: OutputChannel | undefined;

export function getWorkspaceConfig<T>(key: string, defaultValue?: undefined): T | undefined;
export function getWorkspaceConfig<T>(key: string, defaultValue: T): T;
export function getWorkspaceConfig<T>(key: string, defaultValue: T | undefined = undefined) {
  return workspace.getConfiguration('laravel-pint').get<T>(key) || defaultValue;
}

export function getOutputChannel(clear?: undefined): OutputChannel;
export function getOutputChannel(clear: true): void;
export function getOutputChannel(clear?: boolean) {
  if (clear) {
    outputChannel?.clear();
    outputChannel?.dispose();

    outputChannel = undefined;

    return;
  }

  if (!outputChannel) {
    outputChannel = window.createOutputChannel('Laravel Pint');
  }

  return outputChannel;
}