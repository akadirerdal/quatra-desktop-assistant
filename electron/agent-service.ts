/**
 * Agent servisi — renderer isteğini alır, main süreçte güvenle yürütür.
 * API anahtarı yalnızca burada okunur (renderer'a gitmez).
 */
import { BrowserWindow, dialog } from 'electron';
import { DeepSeekClient } from '../src/providers/deepseek/client';
import { ToolRegistry } from '../src/features/tools/registry';
import { PermissionManager } from '../src/features/tools/permissions';
import { createBuiltinTools } from '../src/features/tools/builtins';
import { AgentLoop, DEFAULT_SYSTEM_PROMPT } from '../src/features/agent/loop';
import { getApiKey } from './credentials';
import { createNativeBridge } from './native';
import { appLogger } from '../src/services/log/logger';

export interface AgentRunRequest {
  text: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  personality?: string;
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
    for (const tool of createBuiltinTools(permissions)) registry.register(tool);

    const systemPrompt = req.personality
      ? `${DEFAULT_SYSTEM_PROMPT}\nKullanıcı tercihi: ${req.personality}`
      : DEFAULT_SYSTEM_PROMPT;

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
    emit({ type: 'caption', requestId, text: result.text });
    emit({
      type: 'done',
      requestId,
      text: result.text,
      iterations: result.iterations,
      toolCalls: result.toolCalls,
    });
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
