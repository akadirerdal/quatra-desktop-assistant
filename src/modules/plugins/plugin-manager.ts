import type { Plugin } from './types';

export class PluginManager {
  private plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin already registered: ${plugin.manifest.id}`);
    }
    this.plugins.set(plugin.manifest.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  list(): Plugin[] {
    return [...this.plugins.values()];
  }

  async runCommand(pluginId: string, commandId: string, args?: unknown): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    const cmd = plugin.commands.find((c) => c.id === commandId);
    if (!cmd) throw new Error(`Command not found: ${commandId}`);
    return cmd.run(args);
  }
}
