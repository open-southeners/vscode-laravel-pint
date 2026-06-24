export type PresetOptions = 'auto' | 'laravel' | 'psr12' | 'symfony' | 'per' | 'empty';

export interface ExtensionConfig {
  enable: boolean
  enableDebugLogs: boolean
  preset: PresetOptions
  configPath: string
  executablePath: string
  fallbackToGlobalBin: boolean
  runInDocker: boolean
  dockerExecutablePath: string
  dockerContainerName: string
  dockerContainerRootPath: string
  runInLaravelSail: boolean
  sailExecutablePath: string
  dirtyOnly: boolean
}

export interface ExtensionFormattingOptions {
  force: boolean;
}
