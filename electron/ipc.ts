/**
 * IPC kayıtları — renderer ile güvenli köprü.
 * Kanallar sabit listededir; keyfi kanal/dinamik handler YOKTUR.
 * Kayıtlar süreç başına BİR KEZ yapılır (V1.2-033); her çağrı yalnız ana pencerenin
 * ana çerçevesinden kabul edilir (V1.2-096) ve kritik girdiler doğrulanır (V1.2-044).
 */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, systemPreferences } from 'electron';
import { z } from 'zod';
import { clearApiKey, credentialsAvailable, getApiKey, hasApiKey, setApiKey } from './credentials';
import type { CredentialId } from './credentials';
import { loadSettingsFile, saveSettingsFile } from './settings-file';
import { createNativeBridge } from './native';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { transcribeAudio } from '../src/providers/groq/transcribe';
import { ProviderError } from '../src/providers/types';
import {
  cancelActiveAgent,
  clearAgentContext,
  resolveAgentConfirm,
  runAgent,
} from './agent-service';
import { listEdgeVoices, synthesizeEdge } from './tts-service';
import { clearLogFile, logDir, logFilePath, openLogsFolder } from './log-file';
import { registerMemoryIpc } from './memory';
import { listAudit, clearAudit } from './audit';
import { getUsage } from './usage-store';
import { lastNoteBackup, restoreLastNoteBackup } from './note-backups';
import { appLogger } from '../src/services/log/logger';
import fs from 'node:fs';
import path from 'node:path';

const ipcLog = appLogger.scoped('ipc');

let registeredShortcut: string | null = null;
/** V1.2-033: kayıt yalnız bir kez yapılır; pencere yeniden kurulsa da güncel pencere kullanılır. */
let ipcRegistered = false;
let currentWin: BrowserWindow | null = null;

function isCredentialId(v: unknown): v is CredentialId {
  return v === 'deepseek' || v === 'groq' || v === 'mem0';
}

/** Güncel (yok edilmemiş) pencere — pencere yeniden oluşturulduysa yenisini döner. */
function liveWindow(): BrowserWindow | null {
  return currentWin && !currentWin.isDestroyed() ? currentWin : null;
}

/**
 * V1.2-096: IPC yalnızca kendi penceremizin ANA çerçevesinden kabul edilir.
 * Alt çerçeve (iframe) ya da başka bir webContents kaynaklı çağrı reddedilir;
 * böylece preload köprüsü üzerinden yabancı içerik main'e erişemez.
 */
function isTrustedSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const frame = event.senderFrame;
  if (frame && frame.parent !== null) return false; // yalnız ana çerçeve
  return BrowserWindow.fromWebContents(event.sender) !== null;
}

type IpcHandler<TArgs extends unknown[] = unknown[]> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: TArgs
) => unknown;

/** Guard'lı ipcMain.handle — tüm kanallar buradan kaydolur. */
function handle<TArgs extends unknown[]>(channel: string, fn: IpcHandler<TArgs>): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      ipcLog.warn(`yetkisiz IPC çağrısı reddedildi: ${channel}`);
      throw new Error(`Yetkisiz IPC isteği: ${channel}`);
    }
    // Not: `args` renderer'dan gelen ham değerlerdir; tip yalnız köprü sözleşmesidir
    // (beyan edilen türler main tarafında ayrıca doğrulanır — V1.2-044).
    return fn(event, ...(args as TArgs));
  });
}

type IpcListener<TArgs extends unknown[] = unknown[]> = (
  event: Electron.IpcMainEvent,
  ...args: TArgs
) => void;

/** Guard'lı ipcMain.on — yetkisiz çağrı sessizce yok sayılır (yanıt kanalı yok). */
function listen<TArgs extends unknown[]>(channel: string, fn: IpcListener<TArgs>): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      ipcLog.warn(`yetkisiz IPC çağrısı yok sayıldı: ${channel}`);
      return;
    }
    fn(event, ...(args as TArgs));
  });
}

/**
 * V1.2-044: renderer doğrulaması güven sınırı DEĞİLDİR — agent isteği main'de de doğrulanır
 * (aşırı uzun metin / eksik alan / beklenmeyen tür main'e ulaşamaz). Şema dışı alanlar atılır.
 */
const agentRunSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(65_536).optional(),
  personality: z.string().max(2000).optional(),
  useMemory: z.boolean().optional(),
  detailed: z.boolean().optional(),
  memoryEngine: z.enum(['local', 'mem0']).optional(),
  autoLearn: z.boolean().optional(),
  retainTranscripts: z.boolean().optional(),
});

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function registerIpc(win: BrowserWindow): void {
  currentWin = win; // pencere yeniden kurulduysa güncel örnek kullanılır
  if (ipcRegistered) return; // V1.2-033: ikinci ipcMain.handle kaydı "Attempted to register a second handler" ile tüm kaydı çökertirdi
  ipcRegistered = true;

  // ---------------------------------------------------------------- ayarlar
  handle('settings:load', async () => loadSettingsFile());
  handle('settings:save', async (_e, data: unknown) => {
    if (!isPlainObject(data)) return { ok: false, message: 'Ayarlar nesne olmalı.' };
    let size = 0;
    try {
      size = JSON.stringify(data)?.length ?? 0;
    } catch {
      return { ok: false, message: 'Ayarlar serileştirilemedi.' };
    }
    if (size > 512_000) return { ok: false, message: 'Ayarlar beklenenden büyük.' };
    await saveSettingsFile(data);
    return { ok: true };
  });

  // ---------------------------------------------------------------- credentials (anahtarlar renderer'a ASLA dönmez)
  // V1.2-100: geçersiz id sessizce 'deepseek'e DÜŞMEZ; has/clear/set aynı doğrulamayı uygular.
  handle('credentials:has', async (_e, id: unknown) => {
    if (!isCredentialId(id)) {
      ipcLog.warn(`credentials:has geçersiz id: ${String(id)}`);
      return false;
    }
    return hasApiKey(id);
  });
  handle('credentials:available', async () => credentialsAvailable());
  handle('credentials:set', async (_e, id: unknown, key: string) => {
    if (!isCredentialId(id)) return { ok: false, error: 'Geçersiz anahtar türü.' };
    return setApiKey(id, String(key));
  });
  handle('credentials:clear', async (_e, id: unknown) => {
    if (!isCredentialId(id)) return { ok: false, error: 'Geçersiz anahtar türü.' };
    await clearApiKey(id);
    return { ok: true };
  });

  // ---------------------------------------------------------------- provider (DeepSeek)
  handle('provider:test', async (_e, model: string) => {
    try {
      const client = new DeepSeekClient({
        getApiKey: () => getApiKey('deepseek'),
        timeoutMs: 30_000,
      });
      const res = await client.testConnection(String(model));
      return { ok: true, latencyMs: res.latencyMs };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });
  handle('provider:models', async () => {
    try {
      const client = new DeepSeekClient({
        getApiKey: () => getApiKey('deepseek'),
        timeoutMs: 30_000,
      });
      const models = await client.listModels();
      return { ok: true, models };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('unknown', 'Bilinmeyen hata');
      return { ok: false, code: err.code, message: err.message };
    }
  });

  // ---------------------------------------------------------------- ses tanıma (Groq Whisper)
  handle(
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
        const err =
          e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses tanıma başarısız.');
        return { ok: false, code: err.code, message: err.message };
      }
    },
  );

  // ---------------------------------------------------------------- Edge Neural TTS (ücretsiz, doğal sesler)
  handle('tts:voices', async () => {
    try {
      const voices = await listEdgeVoices();
      return { ok: true, voices };
    } catch (e) {
      const err =
        e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses listesi alınamadı.');
      return { ok: false, code: err.code, message: err.message };
    }
  });
  handle('tts:synthesize', async (_e, text: string, voice: string, rate: number, pitch: number) => {
    try {
      const res = await synthesizeEdge(
        String(text),
        String(voice ?? ''),
        Number(rate) || 1,
        Number(pitch) || 1,
      );
      // Buffer → ArrayBuffer (IPC aktarımı)
      const ab = res.audio.buffer.slice(
        res.audio.byteOffset,
        res.audio.byteOffset + res.audio.byteLength,
      );
      return { ok: true, audio: ab as ArrayBuffer, mime: res.mime };
    } catch (e) {
      const err =
        e instanceof ProviderError ? e : new ProviderError('unknown', 'Ses sentezi başarısız.');
      return { ok: false, code: err.code, message: err.message };
    }
  });

  // ---------------------------------------------------------------- agent
  handle('agent:run', async (_e, req: unknown) => {
    // V1.2-044: istek main tarafında doğrulanır; geçersizse agent hiç başlatılmaz.
    const parsed = agentRunSchema.safeParse(req);
    if (!parsed.success) {
      ipcLog.warn(`agent:run geçersiz istek: ${parsed.error.issues[0]?.message ?? 'şema hatası'}`);
      return { started: false };
    }
    const w = liveWindow();
    if (!w) return { started: false };
    void runAgent(w, parsed.data); // olaylar 'agent:event' ile akar
    return { started: true };
  });
  handle('agent:cancel', async () => {
    cancelActiveAgent();
    return { ok: true };
  });
  handle('agent:confirm', async (_e, requestId: string, approved: boolean) => {
    // Sözlü izin akışı (V1-09): bekleyen onayı çözer; eşleşme yoksa sessizce yok sayar.
    return { ok: true, handled: resolveAgentConfirm(String(requestId ?? ''), approved === true) };
  });

  // ---------------------------------------------------------------- otomatik başlatma (V1-14)
  // Gerçek durum İŞLETİM SİSTEMİNDEN okunur (kayıt defteri). Kaynak modda dürüstçe "desteklenmiyor".
  const loginItemSupported = (): boolean =>
    (process.platform === 'win32' || process.platform === 'darwin') && app.isPackaged;
  handle('app:login-item-get', async () => {
    if (!loginItemSupported()) return { ok: true, supported: false, enabled: false };
    return { ok: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin };
  });
  handle('app:login-item-set', async (_e, enabled: boolean) => {
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
  handle('audit:list', async () => ({ ok: true, entries: listAudit(50) }));
  handle('audit:clear', async () => {
    clearAudit();
    return { ok: true };
  });
  handle('usage:get', async () => ({ ok: true, ...getUsage() }));
  handle('notes:last-backup', async () => ({ ok: true, record: lastNoteBackup() }));
  handle('notes:restore', async () => restoreLastNoteBackup());
  handle('agent:clear-context', async () => {
    clearAgentContext();
    return { ok: true };
  });
  handle('log:clear', async () => {
    appLogger.clear();
    clearLogFile();
    return { ok: true };
  });
  handle('privacy:clear-transcripts', async () => {
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'transcripts.jsonl'), '', 'utf8');
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  // ---------------------------------------------------------------- ayar dışa/içe aktarma
  // Not: settings.json API anahtarı İÇERMEZ (anahtarlar ayrı credential vault'ta).
  handle('settings:export', async () => {
    const parent = liveWindow() ?? undefined;
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
  handle('settings:import', async () => {
    const parent = liveWindow() ?? undefined;
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
  handle('shortcut:register', async (_e, accelerator: string) => {
    const log = appLogger.scoped('shortcut');
    try {
      const combo = String(accelerator || '').trim();
      if (!combo) return { ok: false, message: 'Kısayol boş.' };
      if (combo === registeredShortcut) return { ok: true }; // değişiklik yok
      // V1.2-034: ÖNCE yeni kombinasyon denenir; başarısızsa çalışan kısayol KORUNUR
      // (eskiden önce unregister ediliyordu → kayıt başarısızsa kullanıcı kısayolsuz kalıyordu).
      const ok = globalShortcut.register(combo, () => {
        const w = liveWindow();
        if (w) w.webContents.send('ptt:trigger');
      });
      if (!ok) {
        return {
          ok: false,
          message: `"${combo}" kaydedilemedi (başka uygulama kullanıyor olabilir).${
            registeredShortcut ? ` Önceki kısayol korundu: ${registeredShortcut}` : ''
          }`,
        };
      }
      if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
      registeredShortcut = combo;
      log.info(`global kısayol kayıtlı: ${combo}`);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Kısayol kaydedilemedi.' };
    }
  });

  // ---------------------------------------------------------------- günlükler
  handle('log:open', async () => openLogsFolder());
  handle('log:path', async () => ({ ok: true, path: logFilePath(), dir: logDir() }));
  listen('log:renderer', (_e, level: unknown, scope: unknown, message: unknown) => {
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
  listen('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  listen('window:toggle-maximize', (e) => {
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
  listen('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

  // ---------------------------------------------------------------- native yardımcılar
  handle('tools:pickDirectory', async () => {
    const w = liveWindow();
    return w ? createNativeBridge(w).pickDirectory() : null;
  });
  handle('app:version', async () => app.getVersion());
  // macOS mikrofon izni (TCC): getUserMedia tetiklemeden önce açıkça sorulur.
  // Windows/Linux'ta böyle bir izin kavramı yok — doğrudan "izinli" döner.
  handle('app:mic-access', async () => {
    if (process.platform !== 'darwin') return { ok: true, granted: true };
    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return { ok: true, granted };
    } catch (e) {
      appLogger.scoped('main').warn(`mikrofon izni sorulamadı: ${String(e)}`);
      return { ok: true, granted: true }; // hata → getUserMedia kendi akışını dener
    }
  });
  listen('app:renderer-ready', () => {
    appLogger.scoped('main').info('renderer hazır — React mount edildi');
  });
  // ---------------------------------------------------------------- native yardımcılar
}

export function disposeGlobals(): void {
  globalShortcut.unregisterAll();
  registeredShortcut = null;
}
