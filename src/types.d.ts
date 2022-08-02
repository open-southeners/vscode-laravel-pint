export type PresetOptions = 'auto' | 'laravel' | 'psr12' | 'symfony';

export interface ExtensionConfig {
  enable: boolean
  enableDebugLogs: boolean
  preset: PresetOptions
  configPath: string
  executablePath: string
  fallbackToGlobalBin: boolean
  runInLaravelSail: boolean
  sailExecutablePath: string
}

export interface ExtensionFormattingOptions {
  force: boolean;
}