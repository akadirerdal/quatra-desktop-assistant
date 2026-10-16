/**
 * IPC kayıtları — renderer ile güvenli köprü.
 * Kanallar sabit listededir; keyfi kanal/dinamik handler YOKTUR.
 */
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { clearApiKey, credentialsAvailable, getApiKey, hasApiKey, setApiKey } from './credentials';
import type { CredentialId } from './credentials';
import { loadSettingsFile, saveSettingsFile } from './settings-file';
import { createNativeBridge } from './native';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { transcribeAudio } from '../src/providers/groq/transcribe';
import { ProviderError } from '../src/providers/types';
import { cancelActiveAgent, runAgent } from './agent-service';
import { listEdgeVoices, synthesizeEdge } from './tts-service';
import { logDir, logFilePath, openLogsFolder } from './log-file';
import { registerMemoryIpc } from './memory';
import { appLogger } from '../src/services/log/logger';
import type { AgentRunRequest } from './agent-service';

let registeredShortcut: string | null = null;

function isCredentialId(v: unknown): v is CredentialId {
  return v === 'deepseek' || v === 'groq';
}

export function registerIpc(win: BrowserWindow): void {
  // ---------------------------------------------------------------- ayarlar
  ipcMain.handle('settings:load', async () => loadSettingsFile());
  ipcMain.handle('settings:save', async (_e, data: unknown) => {
    await saveSettingsFile(data);
    return { ok: true };
  });

  // ---------------------------------------------------------------- credentials (anahtarlar renderer'a ASLA dönmez)
  ipcMain.handle('credentials:has', async (_e, id: unknown) =>
    hasApiKey(isCredentialId(id) ? id : 'deepseek'),
  );
  ipcMain.handle('credentials:available', async () => credentialsAvailable());
  ipcMain.handle('credentials:set', async (_e, id: unknown, key: string) => {
    if (!isCredentialId(id)) return { ok: false, error: 'Geçersiz anahtar türü.' };
    return setApiKey(id, String(key));
  });
  ipcMain.handle('credentials:clear', async (_e, id: unknown) => {
    if (isCredentialId(id)) await clearApiKey(id);
    return { ok: true };
  });

  // ---------------------------------------------------------------- provider (DeepSeek)
  ipcMain.handle('provider:test', async (_e, model: string) => {
    try {
      const client = new DeepSeekClient({ getApiKey: () => getApiKey('deepseek'), timeoutMs: 30_000 });
      const res = await client.testConnection(String(model));
      return { ok: true, latencyMs: res.latencyMs };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });
  ipcMain.handle('provider:models', async () => {
    try {
      const client = new DeepSeekClient({ getApiKey: () => getApiKey('deepseek'), timeoutMs: 30_000 });
      const models = await client.listModels();
      return { ok: true, models };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });

  // ---------------------------------------------------------------- ses tanıma (Groq Whisper)
  ipcMain.handle(
    'stt:transcribe',
    async (_e, audio: ArrayBuffer | Uint8Array, mimeType: string, language?: string) => {
      try {
        const key = await getApiKey('groq');
        const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
        const result = await transcribeAudio({
          apiKey: key,
          audio: bytes,
          mimeType: String(mimeType || 'audio/webm'),
          language: language ? String(language) : 'tr',
        });
        return { ok: true, text: result.text };
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses tanıma başarısız.');
        return { ok: false, code: err.code, message: err.message };
      }
    },
  );

  // ---------------------------------------------------------------- Edge Neural TTS (ücretsiz, doğal sesler)
  ipcMain.handle('tts:voices', async () => {
    try {
      const voices = await listEdgeVoices();
      return { ok: true, voices };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses listesi alınamadı.');
      return { ok: false, code: err.code, message: err.message };
    }
  });
  ipcMain.handle(
    'tts:synthesize',
    async (_e, text: string, voice: string, rate: number, pitch: number) => {
      try {
        const res = await synthesizeEdge(String(text), String(voice ?? ''), Number(rate) || 1, Number(pitch) || 1);
        // Buffer → ArrayBuffer (IPC aktarımı)
        const ab = res.audio.buffer.slice(res.audio.byteOffset, res.audio.byteOffset + res.audio.byteLength);
        return { ok: true, audio: ab as ArrayBuffer, mime: res.mime };
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses sentezi başarısız.');
        return { ok: false, code: err.code, message: err.message };
      }
    },
  );

  // ---------------------------------------------------------------- agent
  ipcMain.handle('agent:run', async (_e, req: AgentRunRequest) => {
    void runAgent(win, req); // olaylar 'agent:event' ile akar
    return { started: true };
  });
  ipcMain.handle('agent:cancel', async () => {
    cancelActiveAgent();
    return { ok: true };
  });

  // ---------------------------------------------------------------- global bas-konuş
  ipcMain.handle('shortcut:register', async (_e, accelerator: string) => {
    const log = appLogger.scoped('shortcut');
    try {
      if (registeredShortcut) {
        globalShortcut.unregister(registeredShortcut);
        registeredShortcut = null;
      }
      const combo = String(accelerator || '').trim();
      if (!combo) return { ok: false, message: 'Kısayol boş.' };
      const ok = globalShortcut.register(combo, () => {
        if (!win.isDestroyed()) win.webContents.send('ptt:trigger');
      });
      if (ok) {
        registeredShortcut = combo;
        log.info(`global kısayol kayıtlı: ${combo}`);
        return { ok: true };
      }
      return { ok: false, message: `"${combo}" kaydedilemedi (başka uygulama kullanıyor olabilir).` };
    } catch {
      return { ok: false, message: 'Kısayol kaydedilemedi.' };
    }
  });

  // ---------------------------------------------------------------- günlükler
  ipcMain.handle('log:open', async () => openLogsFolder());
  ipcMain.handle('log:path', async () => ({ ok: true, path: logFilePath(), dir: logDir() }));
  ipcMain.on('log:renderer', (_e, level: unknown, scope: unknown, message: unknown) => {
    const logger = appLogger.scoped(String(scope ?? 'renderer'));
    const msg = String(message ?? '');
    if (level === 'error') logger.error(msg);
    else if (level === 'info') logger.info(msg);
    else if (level === 'debug') logger.debug(msg);
    else logger.warn(msg);
  });

  // ---------------------------------------------------------------- hafıza
  registerMemoryIpc();

  // ---------------------------------------------------------------- pencere kontrolleri (özel başlık çubuğu)
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:toggle-maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (w.isFullScreen()) {
      w.setFullScreen(false);
    } else if (w.isMaximized()) {
      w.unmaximize();
    } else {
      w.maximize();
    }
  });
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

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

export function disposeGlobals(): void {
  globalShortcut.unregisterAll();
  registeredShortcut = null;
}
