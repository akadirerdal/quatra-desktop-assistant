// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IpcSettingsBackend } from '../../../src/renderer/ipc-bridge';
import { installBridgeMock, removeBridgeMock, type BridgeMock } from '../../helpers/bridge';

describe('IpcSettingsBackend', () => {
  let bridge: BridgeMock;

  beforeEach(() => {
    bridge = installBridgeMock({});
  });
  afterEach(() => {
    removeBridgeMock();
  });

  it('load: bridge varken settings.load sonucunu döner', async () => {
    const data = { appearance: { theme: 'gece' } };
    bridge.settings.load = vi.fn(async () => data);
    const backend = new IpcSettingsBackend();
    expect(await backend.load()).toEqual(data);
    expect(bridge.settings.load).toHaveBeenCalled();
  });

  it('load: bridge yokken null döner (tarayıcı/dev fallback)', async () => {
    removeBridgeMock();
    const backend = new IpcSettingsBackend();
    expect(await backend.load()).toBeNull();
  });

  it('save: bridge varken settings.save çağrılır', async () => {
    const backend = new IpcSettingsBackend();
    const data = { x: 1 };
    await backend.save(data);
    expect(bridge.settings.save).toHaveBeenCalledWith(data);
  });

  it('save: bridge yokken sessizce döner (throw etmez)', async () => {
    removeBridgeMock();
    const backend = new IpcSettingsBackend();
    await expect(backend.save({ x: 1 })).resolves.toBeUndefined();
  });

  it('load: bridge settings.load reddederse hata fırlar (caller yakalar)', async () => {
    bridge.settings.load = vi.fn(async () => {
      throw new Error('ipc bozuk');
    });
    const backend = new IpcSettingsBackend();
    await expect(backend.load()).rejects.toThrow('ipc bozuk');
  });
});
