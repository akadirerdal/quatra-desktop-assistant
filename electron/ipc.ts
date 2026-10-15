/**
 * IPC kayıtları — renderer ile güvenli köprü.
 * Kanallar sabit listededir; keyfi kanal/dinamik handler YOKTUR.
 */
import { app, ipcMain, BrowserWindow } from 'electron';
import { clearApiKey, credentialsAvailable, getApiKey, hasApiKey, setApiKey } from './credentials';
import { loadSettingsFile, saveSettingsFile } from './settings-file';
import { createNativeBridge } from './native';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { ProviderError } from '../src/providers/types';
import { cancelActiveAgent, runAgent } from './agent-service';
import { appLogger } from '../src/services/log/logger';
import type { AgentRunRequest } from './agent-service';

export function registerIpc(win: BrowserWindow): void {
  // ---------------------------------------------------------------- ayarlar
  ipcMain.handle('settings:load', async () => loadSettingsFile());
  ipcMain.handle('settings:save', async (_e, data: unknown) => {
    await saveSettingsFile(data);
    return { ok: true };
  });

  // ---------------------------------------------------------------- credentials (anahtar renderer'a ASLA dönmez)
  ipcMain.handle('credentials:has', async () => hasApiKey());
  ipcMain.handle('credentials:available', async () => credentialsAvailable());
  ipcMain.handle('credentials:set', async (_e, key: string) => setApiKey(String(key)));
  ipcMain.handle('credentials:clear', async () => {
    await clearApiKey();
    return { ok: true };
  });

  // ---------------------------------------------------------------- provider
  ipcMain.handle('provider:test', async (_e, model: string) => {
    try {
      const client = new DeepSeekClient({ getApiKey: () => getApiKey(), timeoutMs: 30_000 });
      const res = await client.testConnection(String(model));
      return { ok: true, latencyMs: res.latencyMs };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });
  ipcMain.handle('provider:models', async () => {
    try {
      const client = new DeepSeekClient({ getApiKey: () => getApiKey(), timeoutMs: 30_000 });
      const models = await client.listModels();
      return { ok: true, models };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });

  // ---------------------------------------------------------------- agent
  ipcMain.handle('agent:run', async (_e, req: AgentRunRequest) => {
    void runAgent(win, req); // olaylar 'agent:event' ile akar
    return { started: true };
  });
  ipcMain.handle('agent:cancel', async () => {
    cancelActiveAgent();
    return { ok: true };
  });

  // ---------------------------------------------------------------- native yardımcılar
  ipcMain.handle('tools:pickDirectory', async () => createNativeBridge(win).pickDirectory());
  ipcMain.handle('app:version', async () => app.getVersion());
  ipcMain.on('app:renderer-ready', () => {
    appLogger.scoped('main').info('renderer hazır — React mount edildi');
  });
  ipcMain.handle('app:openExternal', async (_e, url: string) => {
    if (/^https?:\/\//i.test(String(url))) {
      await createNativeBridge(win).openUrl(String(url));
      return { ok: true };
    }
    return { ok: false, message: 'Yalnızca http/https' };
  });
}
