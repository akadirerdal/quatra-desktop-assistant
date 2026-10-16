/**
 * Agent servisi — renderer isteğini alır, main süreçte güvenle yürütür.
 * API anahtarı yalnızca burada okunur (renderer'a gitmez).
 */
import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { ToolRegistry } from '../src/features/tools/registry';
import { PermissionManager } from '../src/features/tools/permissions';
import { createBuiltinTools } from '../src/features/tools/builtins';
import { AgentLoop, DEFAULT_SYSTEM_PROMPT } from '../src/features/agent/loop';
import { MemoryStore } from '../src/services/memory/memory-store';
import { getApiKey } from './credentials';
import { createNativeBridge } from './native';
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
}

export type AgentEvent =
  | { type: 'start'; requestId: string }
  | { type: 'caption'; requestId: string; text: string }
  | { type: 'done'; requestId: string; text: string; iterations: number; toolCalls: number }
  | { type: 'error'; requestId: string; category: string; message: string };

let activeAbort: AbortController | null = null;

export function cancelActiveAgent(): void {
  activeAbort?.abort();
  activeAbort = null;
}

export async function runAgent(
  win: BrowserWindow,
  req: AgentRunRequest,
): Promise<void> {
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

    const client = new DeepSeekClient({
      getApiKey: () => getApiKey('deepseek'),
      timeoutMs: 60_000,
    });

    const permissions = new PermissionManager({
      confirm: async (toolName) => {
        const res = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['İzin ver', 'Reddet'],
          defaultId: 1,
          cancelId: 1,
          title: 'Quatra — İzin gerekli',
          message: `"${toolName}" görevi için izin veriyor musun?`,
          detail: 'Bu işlem yalnızca sen onaylarsan çalışır.',
        });
        return res.response === 0;
      },
    });

    const registry = new ToolRegistry({ timeoutMs: 20_000 });
    for (const tool of createBuiltinTools()) registry.register(tool);

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
              memoryBlock = 'Kullanıcı hakkında hatırlananlar:\n' + results.map((r) => `- ${r.memory}`).join('\n');
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
    registry.register({
      name: 'hafiza_kaydet',
      description:
        'Kullanıcı hakkında KALICI değer taşıyan bir bilgiyi hafızaya ekler (isim, yaş, kalıcı tercih, ilişki, önemli tarih). Geçici şeyleri (anlık durum, hava durumu, sohbet dolgusu) kaydetme. Kaydettiğini kullanıcıya SÖYLEME; yanıtında "hatırladım/not aldım" deme, doğal sohbete devam et. Kısa ve öz yaz (ör. "Kullanıcının adı: Ali").',
      schema: z.object({ text: z.string().min(2).max(500) }),
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Hatırlanacak bilgi (ör. "Kullanıcının adı: Ali")' },
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

    const systemPrompt =
      (memoryBlock ? `${memoryBlock}\n\n` : '') +
      (req.personality
        ? `${DEFAULT_SYSTEM_PROMPT}\nKullanıcı tercihi: ${req.personality}`
        : DEFAULT_SYSTEM_PROMPT) +
      (req.detailed
        ? '\nKullanıcı detaylı yanıt istiyor — bu yanıtı kapsamlı ve ayrıntılı ver.'
        : '');

    log.info(
      `agent başladı — model=${req.model}, hafıza=${memoryBlock ? 'var' : 'yok'}, sıcaklık=${req.temperature ?? '-'}`,
    );

    const loop = new AgentLoop({
      provider: client,
      registry,
      permissions,
      native: createNativeBridge(win),
      model: req.model,
      systemPrompt,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      signal: abort.signal,
    });

    const result = await loop.run(req.text);
    log.info(
      `agent bitti — iterasyon=${result.iterations}, tool=${result.toolCalls}, süre=${Date.now() - startedAt}ms`,
    );
    emit({ type: 'caption', requestId, text: result.text });
    emit({
      type: 'done',
      requestId,
      text: result.text,
      iterations: result.iterations,
      toolCalls: result.toolCalls,
    });

    // ---- Garantili hafıza: model hafiza_kaydet'i çağırmayı unutsa bile ----
    // yerel çıkarım HER ZAMAN çalışır; cevabı geciktirmez (fire-and-forget).
    void persistMemory(req, result.text, client, memoryStore);
  } catch (e) {
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

async function persistMemory(
  req: AgentRunRequest,
  assistantText: string,
  client: DeepSeekClient,
  store: MemoryStore,
): Promise<void> {
  const log = appLogger.scoped('memory');
  try {
    // Kapılar: kapalıysa veya mesajda kişisel sinyal yoksa hiç model çağrısı yapılmaz.
    if (req.autoLearn === false) return;
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
      model: 'deepseek-chat',
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
