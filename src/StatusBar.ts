import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";

/* eslint-disable @typescript-eslint/naming-convention */
export enum FormatterStatus {
  Ready = "check-all",
  Success = "check",
  Ignore = "x",
  Warn = "warning",
  Error = "alert",
  Disabled = "circle-slash",
}

export class StatusBar {
  private statusBarItem: StatusBarItem;
  
  constructor() {
    // Setup the statusBarItem
    this.statusBarItem = window.createStatusBarItem(
      "laravel-pint.status",
      StatusBarAlignment.Right,
      -1
    );
    this.statusBarItem.name = "Laravel Pint";
    this.statusBarItem.text = "Laravel Pint";
    this.statusBarItem.command = "laravel-pint.openOutput";
    this.update(FormatterStatus.Ready);
    this.statusBarItem.show();
  }

  public update(result: FormatterStatus): void {
    this.statusBarItem.text = `$(${result.toString()}) Laravel Pint`;

    // Waiting for VS Code 1.53: https://github.com/microsoft/vscode/pull/116181
    if (result === FormatterStatus.Error) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.errorBackground"
      );
    } else {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.fourgroundBackground"
      );
    }
    
    this.statusBarItem.show();
  }

  public hide() {
    this.statusBarItem.hide();
  }
}