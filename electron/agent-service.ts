/**
 * Agent servisi — renderer isteğini alır, main süreçte güvenle yürütür.
 * API anahtarı yalnızca burada okunur (renderer'a gitmez).
 */
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { ToolRegistry } from '../src/features/tools/registry';
import { PermissionManager, summarizeArgs } from '../src/features/tools/permissions';
import { createBuiltinTools } from '../src/features/tools/builtins';
import {
  AgentLoop,
  DEFAULT_SYSTEM_PROMPT,
  MEMORY_INSTRUCTION,
  type AgentRunResult,
} from '../src/features/agent/loop';
import type { ToolResult } from '../src/features/tools/types';
import { DEEPSEEK_CHAT_MODEL } from '../src/features/agent/models';
import { MemoryStore } from '../src/services/memory/memory-store';
import { getApiKey } from './credentials';
import { createNativeBridge } from './native';
import { loadSettingsFile } from './settings-file';
import { sanitizeSettings } from '../src/state/settings-schema';
import { mem0Add, mem0Search } from './mem0-service';
import {
  EXTRACTION_PROMPT,
  hasMemorySignal,
  isGarbageEntry,
  isNearDuplicate,
  parseExtractedFacts,
  shouldReplaceEntry,
} from '../src/services/memory/extraction';
import { appLogger } from '../src/services/log/logger';
import { ProviderError, isFallbackEligible } from '../src/providers/types';
import {
  appendContextTurn,
  contextToMessages,
  type ContextTurn,
} from '../src/features/agent/context';
import { appendAudit } from './audit';
import { recordUsage } from './usage-store';
import { redactSecrets } from '../src/utils/redact';

export interface AgentRunRequest {
  text: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  personality?: string;
  /** Hafıza kayıtlarının prompt'a eklenmesi (ayarlardan). */
  useMemory?: boolean;
  /** Kullanıcı detaylı yanıt istedi (uzun cevap talimatı eklenir). */
  detailed?: boolean;
  /** Hafıza motoru: local | mem0. */
  memoryEngine?: 'local' | 'mem0';
  /** Konuşmalardan otomatik öğrenme (ayarlardan; varsayılan açık). */
  autoLearn?: boolean;
  /** Konuşma metinleri yerel dosyaya yazılsın mı (varsayılan kapalı — opt-in). */
  retainTranscripts?: boolean;
  /** Pano okuma aracı izni (gizlilik ayarı; verilmezse settings.json'dan okunur). */
  clipboardReadEnabled?: boolean;
  /** tools.enabled haritası (verilmezse settings.json'dan okunur; false = aracı kaydetme). */
  toolsEnabled?: Record<string, boolean>;
}

export type AgentEvent =
  | { type: 'start'; requestId: string }
  | { type: 'sentence'; requestId: string; text: string }
  | {
      type: 'confirm';
      requestId: string;
      tool: string;
      /** V1.2-009: kullanıcıya gösterilecek sanitize edilmiş argüman özeti (kırpılmış + maskeli). */
      argsSummary?: string;
    }
  | { type: 'caption'; requestId: string; text: string }
  | { type: 'media'; requestId: string }
  | { type: 'done'; requestId: string; text: string; iterations: number; toolCalls: number }
  | { type: 'error'; requestId: string; category: string; message: string };

let activeAbort: AbortController | null = null;

interface PendingConfirm {
  requestId: string;
  resolve: (approved: boolean) => void;
}

let pendingConfirm: PendingConfirm | null = null;

/** V1-12 yedek sağlayıcı: Groq sohbet modeli (OpenAI-uyumlu uç). */
const GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';

/** V1-10 kısa süreli bağlam — YALNIZ bellekte tutulur, diske yazılmaz. */
let contextHistory: ContextTurn[] = [];

/** Bağlamı temizle (Ayarlar → Gizlilik → "Konuşma bağlamını temizle"). */
export function clearAgentContext(): void {
  contextHistory = [];
}

export function cancelActiveAgent(): void {
  activeAbort?.abort();
  activeAbort = null;
  pendingConfirm?.resolve(false); // bekleyen sözlü onay iptal → model reddedildi görür
  pendingConfirm = null;
}

/** Sözlü izin yanıtı (V1-09). Eşleşen bekleyiş yoksa handled=false. */
export function resolveAgentConfirm(requestId: string, approved: boolean): boolean {
  if (!pendingConfirm || pendingConfirm.requestId !== requestId) return false;
  const p = pendingConfirm;
  pendingConfirm = null;
  p.resolve(approved);
  return true;
}

export async function runAgent(win: BrowserWindow, req: AgentRunRequest): Promise<void> {
  const log = appLogger.scoped('agent-service');
  cancelActiveAgent(); // yeni istek eskiyi iptal eder (üst üste konuşma yok)
  const abort = new AbortController();
  activeAbort = abort;
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const emit = (event: AgentEvent) => {
    if (!win.isDestroyed()) win.webContents.send('agent:event', event);
  };

  emit({ type: 'start', requestId });
  const startedAt = Date.now();

  try {
    const hasKey = (await getApiKey('deepseek')) !== '';
    if (!hasKey) {
      emit({
        type: 'error',
        requestId,
        category: 'auth',
        message: 'API anahtarı ayarlanmamış. Ayarlar → AI Sağlayıcı bölümünden ekle.',
      });
      return;
    }

    // V1.2-005/006/065: gizlilik/araç ayarları renderer'dan gelmediyse main'deki
    // settings.json'dan okunur — anahtar renderer'a güvenmeden burada da zorlanır.
    const saved = sanitizeSettings(await loadSettingsFile());
    const autoLearn = req.autoLearn ?? saved.memory.autoLearn;
    const clipboardReadEnabled = req.clipboardReadEnabled ?? saved.privacy.clipboardReadEnabled;
    const toolsEnabled = req.toolsEnabled ?? saved.tools.enabled;

    let client = new DeepSeekClient({
      getApiKey: () => getApiKey('deepseek'),
      timeoutMs: 60_000,
    });

    const permissions = new PermissionManager({
      // V1-09: ekran kutusu YOK — Quatra sesle sorar ("Evet mi, hayır mı?"); yanıt bu Promise'i çözer.
      confirm: (toolName, args) => {
        // V1.2-009: onay sorusu yalnız araç adı değil, sanitize edilmiş argüman özetini de taşır.
        emit({ type: 'confirm', requestId, tool: toolName, argsSummary: summarizeArgs(args) });
        return new Promise<boolean>((resolve) => {
          const state: { timer?: ReturnType<typeof setTimeout> } = {};
          const wrapped = (approved: boolean) => {
            if (state.timer) clearTimeout(state.timer);
            resolve(approved);
          };
          state.timer = setTimeout(() => {
            if (pendingConfirm?.resolve === wrapped) {
              pendingConfirm = null;
              resolve(false);
              emit({ type: 'caption', requestId, text: 'Onay gelmediği için işlemi yapmadım.' });
              // V1.2-046: onay penceresi kapandı — isteği terminal duruma getir (cancelled);
              // controller 'processing'te takılı kalmasın. B7 renderer tarafı 'cancelled'ı sessiz filtreler.
              abort.abort();
            }
          }, 20_000);
          pendingConfirm = { requestId, resolve: wrapped };
        });
      },
    });

    const registry = new ToolRegistry({ timeoutMs: 20_000 });
    for (const tool of createBuiltinTools()) {
      // V1.2-006: pano okuma yalnız ayar açıkken modele sunulur.
      if (tool.name === 'clipboard_oku' && !clipboardReadEnabled) continue;
      // V1.2-065: tools.enabled haritasında false olan araç registry'ye hiç girmez.
      if (toolsEnabled[tool.name] === false) continue;
      registry.register(tool);
    }

    // Hafıza: kullanıcı izin verdiyse ilgili kayıtlar prompt'a eklenir (yalnız yerel).
    const memoryStore = new MemoryStore(path.join(app.getPath('userData'), 'memory.json'));
    let memoryBlock = '';
    if (req.useMemory) {
      try {
        if (req.memoryEngine === 'mem0') {
          const mem0Key = await getApiKey('mem0');
          if (mem0Key) {
            const results = await mem0Search(mem0Key, req.text, 6);
            if (results.length) {
              memoryBlock =
                'Kullanıcı hakkında hatırlananlar:\n' +
                results.map((r) => `- ${r.memory}`).join('\n');
            }
          } else {
            memoryBlock = await memoryStore.contextBlock(req.text, 1200);
          }
        } else {
          memoryBlock = await memoryStore.contextBlock(req.text, 1200);
        }
      } catch (e) {
        log.warn(`hafıza araması başarısız (yerel devam): ${String(e)}`);
        memoryBlock = await memoryStore.contextBlock(req.text, 1200);
      }
    }

    // Model, konuşma içinde öğrendiği KALICI bilgileri SESSİZCE hafızaya yazar.
    // V1.2-005: otomatik öğrenme kapalıyken bu araç registry'ye HİÇ eklenmez.
    if (autoLearn) {
      registry.register({
        name: 'hafiza_kaydet',
        description:
          'Kullanıcı hakkında KALICI değer taşıyan bir bilgiyi hafızaya ekler (isim, yaş, kalıcı tercih, ilişki, önemli tarih). Geçici şeyleri (anlık durum, hava durumu, sohbet dolgusu) kaydetme. Kaydettiğini kullanıcıya SÖYLEME; yanıtında "hatırladım/not aldım" deme, doğal sohbete devam et. Kısa ve öz yaz (ör. "Kullanıcının adı: Ali").',
        schema: z.object({ text: z.string().min(2).max(500) }),
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Hatırlanacak bilgi (ör. "Kullanıcının adı: Ali")',
            },
          },
          required: ['text'],
        },
        permission: 'safe',
        run: async (args: { text: string }) => {
          const text = String(args.text).trim();
          if (!text || isGarbageEntry(text)) return { saved: false };
          const existing = (await memoryStore.load()).find((e) => shouldReplaceEntry(e.text, text));
          if (existing) await memoryStore.remove(existing.id);
          await memoryStore.add(text, 'assistant');
          return { saved: true };
        },
      });
    }

    const assistantName = (saved.assistantName || 'Quatra').trim() || 'Quatra';
    const basePrompt = DEFAULT_SYSTEM_PROMPT.replace(/^Sen Quatra,/, `Sen ${assistantName},`);
    const systemPrompt =
      (memoryBlock ? `${memoryBlock}\n\n` : '') +
      (req.personality ? `${basePrompt}\nKullanıcı tercihi: ${req.personality}` : basePrompt) +
      // V1.2-005: kaydetme talimatı yalnız otomatik öğrenme açıkken prompt'a girer.
      (autoLearn ? `\n${MEMORY_INSTRUCTION}` : '') +
      (req.detailed
        ? '\nKullanıcı detaylı yanıt istiyor — bu yanıtı kapsamlı ve ayrıntılı ver.'
        : '');

    log.info(
      `agent başladı — model=${req.model}, hafıza=${memoryBlock ? 'var' : 'yok'}, sıcaklık=${req.temperature ?? '-'}`,
    );

    // V1.2-070: istek düzeyinde tool önbelleği + cümle bastırma — yedek denemede
    // ilk denemenin yan etkileri/TTS cümleleri ikinci kez işlenmez.
    const toolResultCache = new Map<string, ToolResult>();
    let firstAttemptSpoke = false;

    const buildLoop = (
      provider: DeepSeekClient,
      model: string,
      opts: { suppressSentences?: boolean } = {},
    ) =>
      new AgentLoop({
        provider,
        registry,
        permissions,
        native: createNativeBridge(win),
        model,
        systemPrompt,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        signal: abort.signal,
        context: contextToMessages(contextHistory),
        toolResultCache,
        onSentence: opts.suppressSentences
          ? undefined
          : (text) => {
              firstAttemptSpoke = true;
              emit({ type: 'sentence', requestId, text });
            },
        onToolEvent: (info) => {
          // V1.2-038: hassas araçların (ör. pano) ham çıktısı audit'e YAZILMAZ; diğerleri 300 karakterle kırpılır.
          const tool = registry.get(info.tool);
          const sensitive = tool?.permission === 'sensitive';
          const detail =
            sensitive && info.ok
              ? '(hassas sonuç — gizlilik gereği kaydedilmedi)'
              : (info.error ?? info.resultJson).slice(0, 300);
          appendAudit({
            ts: new Date().toISOString(),
            tool: info.tool,
            ok: info.ok,
            detail,
            ms: info.ms,
          });
          // V1.2: medya açan araçlarda wake servisi duraklatılır (müzik kendi kendine uyandırmasın).
          if (info.ok && (info.tool === 'open_url' || info.tool === 'open_app')) {
            emit({ type: 'media', requestId });
          }
        },
      });

    let usedFallback = false;
    let result: AgentRunResult;
    try {
      result = await buildLoop(client, req.model).run(req.text);
    } catch (e) {
      // V1-12: ana sağlayıcı GEÇİCİ hatayla düştüyse yedeğe geç (iptal hariç, anahtar varsa).
      const code = e instanceof ProviderError ? e.code : 'unknown';
      const groqKey = await getApiKey('groq');
      if (!isFallbackEligible(code) || !groqKey || abort.signal.aborted) throw e;
      log.warn(`ana sağlayıcı hatası (${code}) → yedek sağlayıcıya geçiliyor`);
      emit({
        type: 'caption',
        requestId,
        text: 'Ana sağlayıcı yanıt vermedi — yedek sağlayıcıya geçtim.',
      });
      client = new DeepSeekClient({
        baseUrl: 'https://api.groq.com/openai/v1',
        getApiKey: () => getApiKey('groq'),
        timeoutMs: 60_000,
        maxRetries: 1,
      });
      usedFallback = true;
      // İlk deneme cümle akıttıysa yedeğin cümlelerini TEKRAR akıtma (çift seslendirme olmasın).
      result = await buildLoop(client, GROQ_FALLBACK_MODEL, {
        suppressSentences: firstAttemptSpoke,
      }).run(req.text);
    }

    log.info(
      `agent bitti — iterasyon=${result.iterations}, tool=${result.toolCalls}, süre=${Date.now() - startedAt}ms${usedFallback ? ' (yedek sağlayıcı)' : ''}`,
    );
    // Kısa süreli bağlam (V1-10): yalnız BAŞARILI tur eklenir.
    contextHistory = appendContextTurn(contextHistory, req.text, result.text);
    // Token sayaçları (V1-19): sağlayıcı bildirdiyse kaydet.
    if (result.usage) recordUsage(result.usage.promptTokens, result.usage.completionTokens);
    // Konuşma kaydı (opt-in, varsayılan kapalı).
    if (req.retainTranscripts) appendTranscript(req.text, result.text);
    // V1.2-071: token sınırında kesilen yanıt görsel olarak işaretlenir (sesli okuma temiz kalır).
    emit({
      type: 'caption',
      requestId,
      text: result.truncated
        ? `${result.text}\n\n(Yanıt token sınırına ulaştı — kesilmiş olabilir.)`
        : result.text,
    });
    emit({
      type: 'done',
      requestId,
      text: result.text,
      iterations: result.iterations,
      toolCalls: result.toolCalls,
    });

    // ---- Garantili hafıza: model hafiza_kaydet'i çağırmayı unutsa bile ----
    // yerel çıkarım HER ZAMAN çalışır; cevabı geciktirmez (fire-and-forget).
    void persistMemory(
      req,
      result.text,
      client,
      memoryStore,
      usedFallback ? GROQ_FALLBACK_MODEL : DEEPSEEK_CHAT_MODEL,
      autoLearn,
    );
  } catch (e) {
    // V1.2-013: iptal edilen istek sessiz terminal yoldur — category 'cancelled',
    // requestId korunur (controller B7 bu hatayı filtreler).
    if (abort.signal.aborted) {
      log.info('agent iptal edildi');
      emit({ type: 'error', requestId, category: 'cancelled', message: 'İptal edildi.' });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    const category =
      e instanceof Error && 'code' in e && typeof (e as { code?: unknown }).code === 'string'
        ? (e as { code: string }).code
        : 'unknown';
    log.error(`agent hata: ${msg}`);
    emit({ type: 'error', requestId, category, message: msg });
  } finally {
    if (activeAbort === abort) activeAbort = null;
  }
}

// ---- Hafıza çıkarımı: yalnızca KALICI bilgiler, sessizce ----

/** transcripts.jsonl üst sınırı (V1.2-045): bu boyutu aşınca dosya son kısmına kırpılır. */
const TRANSCRIPT_MAX_BYTES = 5 * 1024 * 1024;
const TRANSCRIPT_KEEP_BYTES = 2 * 1024 * 1024;

/** Dosya sınırı aştıysa yalnız son ~2 MB'ı (satır sınırında) bırakır — sınırsız büyüme olmaz. */
function trimTranscriptIfNeeded(file: string): void {
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    return; // dosya henüz yok
  }
  if (size <= TRANSCRIPT_MAX_BYTES) return;
  const raw = fs.readFileSync(file, 'utf8');
  let tail = raw.slice(-TRANSCRIPT_KEEP_BYTES);
  const firstNewline = tail.indexOf('\n'); // ortadan kesilmiş satır bırakma
  if (firstNewline >= 0) tail = tail.slice(firstNewline + 1);
  fs.writeFileSync(file, tail, 'utf8');
}

/** Konuşma kaydı (opt-in) — userData/transcripts.jsonl; secret'lar redact edilir. */
function appendTranscript(userText: string, assistantText: string): void {
  try {
    const file = path.join(app.getPath('userData'), 'transcripts.jsonl');
    trimTranscriptIfNeeded(file); // V1.2-045: sınır/rotasyon
    fs.appendFileSync(
      file,
      JSON.stringify({
        ts: new Date().toISOString(),
        user: redactSecrets(userText),
        assistant: redactSecrets(assistantText),
      }) + '\n',
      'utf8',
    );
  } catch {
    // kayıt kritik değil — asistan akışını etkilemez
  }
}

async function persistMemory(
  req: AgentRunRequest,
  assistantText: string,
  client: DeepSeekClient,
  store: MemoryStore,
  chatModel: string,
  autoLearn: boolean,
): Promise<void> {
  const log = appLogger.scoped('memory');
  try {
    // Kapılar: kapalıysa veya mesajda kişisel sinyal yoksa hiç model çağrısı yapılmaz.
    if (!autoLearn) return;
    if (!hasMemorySignal(req.text)) return;

    // 1) mem0 motoru seçiliyse buluta da yaz (kullanıcı bu motoru seçtiyse).
    if (req.memoryEngine === 'mem0') {
      const mem0Key = await getApiKey('mem0');
      if (mem0Key) {
        try {
          await mem0Add(mem0Key, [
            { role: 'user', content: req.text.slice(0, 2000) },
            { role: 'assistant', content: assistantText.slice(0, 2000) },
          ]);
          log.info('hafıza: mem0 senkronu tamam');
        } catch (e) {
          log.warn(`hafıza: mem0 senkronu hata (yerel devam): ${String(e)}`);
        }
      }
    }

    // 2) Yerel çıkarım — model tool çağırmayı unutsa da kalıcı bilgiler yakalanır.
    const res = await client.chat({
      model: chatModel,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Kullanıcı: ${req.text.slice(0, 1200)}\nAsistan: ${assistantText.slice(0, 1200)}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 300,
    });
    if (res.usage) recordUsage(res.usage.promptTokens, res.usage.completionTokens);
    const facts = parseExtractedFacts(res.content).filter((f) => !isGarbageEntry(f));
    let saved = 0;
    for (const fact of facts) {
      const entries = await store.load();
      const replace = entries.find((e) => shouldReplaceEntry(e.text, fact));
      if (replace) await store.remove(replace.id);
      else if (entries.some((e) => isNearDuplicate(e.text, fact))) continue;
      await store.add(fact, 'assistant');
      saved += 1;
    }
    if (saved > 0) log.info(`hafıza: ${saved} kalıcı bilgi öğrenildi`);
  } catch (e) {
    log.warn(`hafıza çıkarımı başarısız: ${String(e)}`);
  }
}
