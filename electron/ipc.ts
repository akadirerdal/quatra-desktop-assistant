/**
 * IPC kayıtları — renderer ile güvenli köprü.
 * Kanallar sabit listededir; keyfi kanal/dinamik handler YOKTUR.
 */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain } from 'electron';
import { clearApiKey, credentialsAvailable, getApiKey, hasApiKey, setApiKey } from './credentials';
import type { CredentialId } from './credentials';
import { loadSettingsFile, saveSettingsFile } from './settings-file';
import { createNativeBridge } from './native';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { transcribeAudio } from '../src/providers/groq/transcribe';
import { ProviderError } from '../src/providers/types';
import { cancelActiveAgent, clearAgentContext, resolveAgentConfirm, runAgent } from './agent-service';
import { listEdgeVoices, synthesizeEdge } from './tts-service';
import { clearLogFile, logDir, logFilePath, openLogsFolder } from './log-file';
import { registerMemoryIpc } from './memory';
import { listAudit, clearAudit } from './audit';
import { getUsage } from './usage-store';
import { lastNoteBackup, restoreLastNoteBackup } from './note-backups';
import { appLogger } from '../src/services/log/logger';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentRunRequest } from './agent-service';

let registeredShortcut: string | null = null;

function isCredentialId(v: unknown): v is CredentialId {
  return v === 'deepseek' || v === 'groq' || v === 'mem0';
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
        return {
          ok: true,
          text: result.text,
          ...(result.filtered ? { filtered: result.filtered } : {}),
        };
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
  ipcMain.handle('agent:confirm', async (_e, requestId: string, approved: boolean) => {
    // Sözlü izin akışı (V1-09): bekleyen onayı çözer; eşleşme yoksa sessizce yok sayar.
    return { ok: true, handled: resolveAgentConfirm(String(requestId ?? ''), approved === true) };
  });

  // ---------------------------------------------------------------- otomatik başlatma (V1-14)
  // Gerçek durum İŞLETİM SİSTEMİNDEN okunur (kayıt defteri). Kaynak modda dürüstçe "desteklenmiyor".
  const loginItemSupported = (): boolean =>
    (process.platform === 'win32' || process.platform === 'darwin') && app.isPackaged;
  ipcMain.handle('app:login-item-get', async () => {
    if (!loginItemSupported()) return { ok: true, supported: false, enabled: false };
    return { ok: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin };
  });
  ipcMain.handle('app:login-item-set', async (_e, enabled: boolean) => {
    if (!loginItemSupported()) {
      return {
        ok: false,
        supported: false,
        message: 'Otomatik başlatma yalnız kurulu (paketlenmiş) sürümde kullanılabilir.',
      };
    }
    app.setLoginItemSettings({ openAtLogin: enabled === true });
    return { ok: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin };
  });

  // ---------------------------------------------------------------- işlem günlüğü / sayaçlar (V1-17/19)
  ipcMain.handle('audit:list', async () => ({ ok: true, entries: listAudit(50) }));
  ipcMain.handle('audit:clear', async () => {
    clearAudit();
    return { ok: true };
  });
  ipcMain.handle('usage:get', async () => ({ ok: true, ...getUsage() }));
  ipcMain.handle('notes:last-backup', async () => ({ ok: true, record: lastNoteBackup() }));
  ipcMain.handle('notes:restore', async () => restoreLastNoteBackup());
  ipcMain.handle('agent:clear-context', async () => {
    clearAgentContext();
    return { ok: true };
  });
  ipcMain.handle('log:clear', async () => {
    appLogger.clear();
    clearLogFile();
    return { ok: true };
  });
  ipcMain.handle('privacy:clear-transcripts', async () => {
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'transcripts.jsonl'), '', 'utf8');
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  // ---------------------------------------------------------------- ayar dışa/içe aktarma
  // Not: settings.json API anahtarı İÇERMEZ (anahtarlar ayrı credential vault'ta).
  ipcMain.handle('settings:export', async () => {
    const parent = win && !win.isDestroyed() ? win : undefined;
    const opts = {
      defaultPath: 'quatra-ayarlar.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, opts)
      : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { ok: true, canceled: true };
    try {
      const data = await loadSettingsFile();
      fs.writeFileSync(result.filePath, JSON.stringify(data ?? {}, null, 2), 'utf8');
      return { ok: true, path: result.filePath };
    } catch {
      return { ok: false, message: 'Ayarlar dosyaya yazılamadı.' };
    }
  });
  ipcMain.handle('settings:import', async () => {
    const parent = win && !win.isDestroyed() ? win : undefined;
    const opts = {
      properties: ['openFile' as const],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };
    try {
      const parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: 'Dosya geçerli bir ayar dosyası değil.' };
      }
      await saveSettingsFile(parsed); // renderer load() zod ile temizler
      return { ok: true };
    } catch {
      return { ok: false, message: 'Dosya okunamadı veya bozuk.' };
    }
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
