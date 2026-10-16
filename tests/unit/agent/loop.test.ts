import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../../src/features/tools/registry';
import { PermissionManager } from '../../../src/features/tools/permissions';
import { AgentLoop } from '../../../src/features/agent/loop';
import type { NativeBridge } from '../../../src/features/tools/types';
import type { ProviderAdapter, ProviderChatRequest, ProviderChatResponse } from '../../../src/providers/types';

// Sahte native köprü — gerçek OS erişimi YOK.
const native: NativeBridge = {
  sysinfo: vi.fn(async () => ({ platform: 'win32', hostname: 'test' })),
  openApp: vi.fn(async () => undefined),
  openUrl: vi.fn(async () => undefined),
  writeNote: vi.fn(async (_text: string, filename: string) => ({ path: `/notes/${filename}` })),
  clipboardWrite: vi.fn(async () => undefined),
  clipboardRead: vi.fn(async () => 'gizli-metin'),
  pickDirectory: vi.fn(async () => '/notes'),
  folderExists: vi.fn(async () => true),
  getNotesDirectory: vi.fn(async () => ''),
  rememberNotesDirectory: vi.fn(async () => undefined),
  getAppVersion: () => '0.1.0-test',
};

function makeRegistry() {
  const registry = new ToolRegistry({ timeoutMs: 2000 });
  registry.register({
    name: 'echo',
    description: 'echo testi',
    schema: z.object({ text: z.string().min(1) }),
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    permission: 'safe',
    run: async (args: { text: string }) => ({ echoed: args.text }),
  });
  registry.register({
    name: 'tehlikeli',
    description: 'sensitive test',
    schema: z.object({}),
    parameters: { type: 'object', properties: {} },
    permission: 'sensitive',
    requiresConfirmation: true,
    run: async () => ({ done: true }),
  });
  registry.register({
    name: 'yavas',
    description: 'yavaş test',
    schema: z.object({}),
    parameters: { type: 'object', properties: {} },
    permission: 'safe',
    run: async () => {
      await new Promise((r) => setTimeout(r, 5000));
      return { done: true };
    },
  });
  return registry;
}

interface ScriptedStep {
  response: ProviderChatResponse;
}

function scriptedProvider(steps: ScriptedStep[]): ProviderAdapter {
  let i = 0;
  return {
    chat: vi.fn(async (req: ProviderChatRequest) => {
      const step = steps[Math.min(i, steps.length - 1)];
      i += 1;
      void req;
      return step.response;
    }),
    chatStream: vi.fn(async () => {
      throw new Error('stream test dışı');
    }),
    listModels: vi.fn(async () => []),
    testConnection: vi.fn(async () => ({ ok: true as const, model: 'x', latencyMs: 1 })),
  };
}

const permissions = new PermissionManager();

describe('AgentLoop — tool çağrısı', () => {
  it('model tool ister → çalıştırır → final cevap döner', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"merhaba"}' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'Tamam, yaptım.', finishReason: 'stop' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'deepseek-chat',
      systemPrompt: 'test',
    });
    const res = await loop.run('yankı yap');
    expect(res.text).toBe('Tamam, yaptım.');
    expect(res.toolCalls).toBe(1);
    expect(res.iterations).toBe(2);
  });

  it('bilinmeyen tool reddedilir ve modele hata döner', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'olmayan_tool', arguments: '{}' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'hata gördüm', finishReason: 'stop' } },
    ]);
    const registry = makeRegistry();
    const executeSpy = vi.spyOn(registry, 'execute');
    const loop = new AgentLoop({
      provider,
      registry,
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
    });
    const res = await loop.run('bir şey yap');
    expect(executeSpy).not.toHaveBeenCalled(); // bilinmeyen tool registry'ye hiç gitmez
    expect(res.text).toBe('hata gördüm');
  });

  it('bozuk argüman hata sonucu döner, loop ölmez', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'echo', arguments: '{bozuk json' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'argümanı düzelttim', finishReason: 'stop' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
    });
    const res = await loop.run('echo yap');
    expect(res.text).toBe('argümanı düzelttim');
  });

  it('sensitive tool onaysız reddedilir', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'tehlikeli', arguments: '{}' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'izin yoktu', finishReason: 'stop' } },
    ]);
    const noConfirm = new PermissionManager(); // confirm fonksiyonu yok → red
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions: noConfirm,
      native,
      model: 'x',
      systemPrompt: 'test',
    });
    const res = await loop.run('tehlikeli iş');
    expect(res.text).toBe('izin yoktu');
  });

  it('sensitive tool onay gelirse çalışır', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'tehlikeli', arguments: '{}' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'onaylı iş bitti', finishReason: 'stop' } },
    ]);
    const confirming = new PermissionManager({ confirm: async () => true });
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions: confirming,
      native,
      model: 'x',
      systemPrompt: 'test',
    });
    const res = await loop.run('tehlikeli iş');
    expect(res.text).toBe('onaylı iş bitti');
  });

  it('iterasyon limitinde dürüst durur', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"a"}' }],
          finishReason: 'tool_calls',
        },
      },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
      maxIterations: 2,
    });
    const res = await loop.run('sonsuz döngü');
    expect(res.stoppedByLimit).toBe(true);
    expect(res.iterations).toBe(2);
  });

  it('yavaş tool loopu kilitlemez — timeout sonucu döner', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'yavas', arguments: '{}' }],
          finishReason: 'tool_calls',
        },
      },
      { response: { content: 'yavaş tool zaman aşımına uğradı', finishReason: 'stop' } },
    ]);
    const registry = new ToolRegistry({ timeoutMs: 50 });
    registry.register({
      name: 'yavas',
      description: 'yavaş',
      schema: z.object({}),
      parameters: { type: 'object', properties: {} },
      permission: 'safe',
      run: async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return { done: true };
      },
    });
    const loop = new AgentLoop({
      provider,
      registry,
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
    });
    const started = Date.now();
    const res = await loop.run('yavaş iş');
    expect(Date.now() - started).toBeLessThan(3000);
    expect(res.text).toBe('yavaş tool zaman aşımına uğradı');
  });

  it('kullanıcı iptali loopu durdurur', async () => {
    const controller = new AbortController();
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          toolCalls: [{ id: 'c1', name: 'yavas', arguments: '{}' }],
          finishReason: 'tool_calls',
        },
      },
    ]);
    const registry = new ToolRegistry({ timeoutMs: 5000 });
    registry.register({
      name: 'yavas',
      description: 'yavaş',
      schema: z.object({}),
      parameters: { type: 'object', properties: {} },
      permission: 'safe',
      run: async (_a: unknown, ctx: { signal?: AbortSignal }) => {
        await new Promise((_r, rej) => {
          ctx.signal?.addEventListener('abort', () => rej(new Error('Görev iptal edildi.')));
        });
        return { done: true };
      },
    });
    const loop = new AgentLoop({
      provider,
      registry,
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
      signal: controller.signal,
    });
    const p = loop.run('uzun iş');
    setTimeout(() => controller.abort(), 30);
    await expect(p).rejects.toThrow(/iptal/i);
  });
});

describe('AgentLoop — akış (streaming) cümleleri', () => {
  function streamingProvider(
    steps: Array<{ deltas: string[]; response: ProviderChatResponse }>,
  ): ProviderAdapter {
    let i = 0;
    return {
      chat: vi.fn(async () => {
        throw new Error('bu testte chat kullanılmaz');
      }),
      chatStream: vi.fn(async (_req: ProviderChatRequest, onDelta: (t: string) => void) => {
        const step = steps[Math.min(i, steps.length - 1)]!;
        i += 1;
        for (const d of step.deltas) onDelta(d);
        return step.response;
      }),
      listModels: vi.fn(async () => []),
      testConnection: vi.fn(async () => ({ ok: true as const, model: 'x', latencyMs: 1 })),
    };
  }

  it('tamamlanan cümleleri sırayla onSentence ile bildirir', async () => {
    const provider = streamingProvider([
      {
        deltas: ['Merhaba dünya. ', 'Nasılsın bugün bakalım', '? İyiyim'],
        response: {
          content: 'Merhaba dünya. Nasılsın bugün bakalım? İyiyim',
          finishReason: 'stop',
        },
      },
    ]);
    const sentences: string[] = [];
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
      onSentence: (s) => sentences.push(s),
    });
    const res = await loop.run('merhaba de');
    expect(sentences).toEqual(['Merhaba dünya.', 'Nasılsın bugün bakalım?', 'İyiyim']);
    expect(res.text).toBe('Merhaba dünya. Nasılsın bugün bakalım? İyiyim');
  });

  it('tool turunda yarım cümleyi AKTARMAZ, final turda akar', async () => {
    const provider = streamingProvider([
      {
        deltas: ['Bakıyorum'],
        response: {
          content: 'Bakıyorum',
          toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"x"}' }],
          finishReason: 'tool_calls',
        },
      },
      {
        deltas: ['Tamam'],
        response: { content: 'Tamam.', finishReason: 'stop' },
      },
    ]);
    const sentences: string[] = [];
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'test',
      onSentence: (s) => sentences.push(s),
    });
    const res = await loop.run('echo yap');
    expect(sentences).toEqual(['Tamam']);
    expect(res.text).toBe('Tamam.');
  });
});

describe('AgentLoop — kısa süreli bağlam (V1-10)', () => {
  it('bağlam turları system ile güncel mesaj arasına girer', async () => {
    const provider = scriptedProvider([
      { response: { content: 'devam edelim', finishReason: 'stop' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'sys',
      context: [
        { role: 'user', content: 'yarın hava nasıl?' },
        { role: 'assistant', content: 'Yarın güneşli görünüyor.' },
      ],
    });
    await loop.run('peki ya sonraki gün?');
    const call = vi.mocked(provider.chat).mock.calls[0]![0];
    expect(call.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(call.messages[1]!.content).toBe('yarın hava nasıl?');
    expect(call.messages[3]!.content).toBe('peki ya sonraki gün?');
  });
});

describe('AgentLoop — kullanım sayaçları ve tool olayları (V1-17/19)', () => {
  it('sağlayıcı usage dönerse turların toplamını verir; tool olayı yayılır', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          finishReason: 'tool_calls',
          usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
          toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"a"}' }],
        },
      },
      {
        response: {
          content: 'Bitti.',
          finishReason: 'stop',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 },
        },
      },
    ]);
    const events: Array<{ tool: string; ok: boolean }> = [];
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'sys',
      onToolEvent: (e) => events.push({ tool: e.tool, ok: e.ok }),
    });
    const result = await loop.run('yankı yap');
    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 7 });
    expect(events).toEqual([{ tool: 'echo', ok: true }]);
  });

  it('usage yoksa alan boş kalır; tool olayı hata bilgisini taşır', async () => {
    const provider = scriptedProvider([
      {
        response: {
          content: '',
          finishReason: 'tool_calls',
          toolCalls: [{ id: 'c1', name: 'yok_böyle', arguments: '{}' }],
        },
      },
      { response: { content: 'hata gördüm', finishReason: 'stop' } },
    ]);
    const events: Array<{ ok: boolean; error?: string; ms: number }> = [];
    const loop = new AgentLoop({
      provider,
      registry: makeRegistry(),
      permissions,
      native,
      model: 'x',
      systemPrompt: 'sys',
      onToolEvent: (e) => events.push({ ok: e.ok, error: e.error, ms: e.ms }),
    });
    const result = await loop.run('bir şey yap');
    expect(result.usage).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]!.ok).toBe(false);
    expect(events[0]!.error).toBe('Bilinmeyen görev adı.');
    expect(typeof events[0]!.ms).toBe('number');
  });
});
