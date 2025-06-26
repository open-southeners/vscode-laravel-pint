import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";

/* eslint-disable @typescript-eslint/naming-convention */
export enum FormatterStatus {
  Ready = "plug",
  Success = "check",
  Ignore = "x",
  Warn = "warning",
  Error = "alert",
  Disabled = "circle-slash",
  Loading = "loading~spin",
}

// TODO: Not there yet...
interface StatusBarResultMeta {
  fixes: number
  fixTypes: Array<string>
}

export class StatusBar {
  private statusBarItem: StatusBarItem;
  private editCount: number = 0;
  
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
  
  public update(result: FormatterStatus, meta?: StatusBarResultMeta): number {
    this.statusBarItem.text = `$(${result.toString()}) Laravel Pint`;
    
    if (result === FormatterStatus.Disabled) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "disabledForeground"
      );

      this.statusBarItem.tooltip = "Laravel Pint is disabled on this file";
    }
    
    if (result === FormatterStatus.Error) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.errorBackground"
      );
        
      this.statusBarItem.tooltip = "Laravel Pint exited with an error (click here for more info)";
    }
    
    if (result === FormatterStatus.Warn) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground"
      );
        
      this.statusBarItem.tooltip = "Laravel Pint exited with an error (click here for more info)";
    }
      
    if (result === FormatterStatus.Ready) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.background"
      );
      
      this.statusBarItem.tooltip = "Laravel Pint is ready to run on this file";
    }

    if (result === FormatterStatus.Success) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.activeBackground"
      );

      this.statusBarItem.tooltip = "Laravel Pint ran successfully fixing this file";
    }

    if (result === FormatterStatus.Loading) {
      this.statusBarItem.backgroundColor = new ThemeColor(
        "statusBarItem.prominentBackground"
      );

      this.statusBarItem.tooltip = "Laravel Pint is running on this file";
    }
    
    this.statusBarItem.show();

    return ++this.editCount;
  }

  public hide() {
    this.statusBarItem.hide();
  }

  public getEditCount(): number {
    return this.editCount;
  }
}