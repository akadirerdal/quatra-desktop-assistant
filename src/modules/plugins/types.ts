export interface PluginManifest {
  id: string;
  name: string;
  version: string;
}

export interface PluginCommand {
  id: string;
  title: string;
  run: (args?: unknown) => Promise<unknown> | unknown;
}

export interface Plugin {
  manifest: PluginManifest;
  commands: PluginCommand[];
}
