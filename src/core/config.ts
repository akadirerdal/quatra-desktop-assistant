export interface AppConfig {
  appName: string;
  version: string;
  defaultProvider: string;
}

const defaultConfig: AppConfig = {
  appName: 'Quatra Desktop Assistant',
  version: '0.1.0',
  defaultProvider: 'mock',
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...defaultConfig, ...overrides };
}
