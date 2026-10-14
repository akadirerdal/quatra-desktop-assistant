import { describe, expect, it } from 'vitest';
import { PluginManager } from '../../src/modules/plugins/plugin-manager';

describe('PluginManager', () => {
  it('registers and runs commands', async () => {
    const pm = new PluginManager();
    pm.register({
      manifest: { id: 'notes', name: 'Notes', version: '0.1.0' },
      commands: [{ id: 'ping', title: 'Ping', run: () => 'pong' }],
    });
    expect(pm.list()).toHaveLength(1);
    await expect(pm.runCommand('notes', 'ping')).resolves.toBe('pong');
  });

  it('rejects duplicate registration', () => {
    const pm = new PluginManager();
    const plugin = {
      manifest: { id: 'dup', name: 'Dup', version: '0.1.0' },
      commands: [],
    };
    pm.register(plugin);
    expect(() => pm.register(plugin)).toThrow();
  });

  it('throws for unknown plugin/command', async () => {
    const pm = new PluginManager();
    await expect(pm.runCommand('nope', 'x')).rejects.toThrow();
  });
});
