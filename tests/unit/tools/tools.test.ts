import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import { z } from 'zod';
import { ToolRegistry } from '../../../src/features/tools/registry';
import { PermissionManager, summarizeArgs } from '../../../src/features/tools/permissions';
import { createBuiltinTools } from '../../../src/features/tools/builtins';
import type { NativeBridge } from '../../../src/features/tools/types';

const native: NativeBridge = {
  sysinfo: vi.fn(async () => ({ platform: 'win32' })),
  openApp: vi.fn(async () => undefined),
  openUrl: vi.fn(async () => undefined),
  writeNote: vi.fn(async (_t: string, f: string) => ({ path: f })),
  clipboardWrite: vi.fn(async () => undefined),
  clipboardRead: vi.fn(async () => 'x'),
  pickDirectory: vi.fn(async () => '/secim'),
  folderExists: vi.fn(async () => true),
  getNotesDirectory: vi.fn(async () => ''),
  rememberNotesDirectory: vi.fn(async () => undefined),
  getAppVersion: () => '0.1.0-test',
};

// Modül düzeyi mock çağrı geçmişi testler arasında sızmamalı (V1.2-081):
// aksi halde bir testin assertion'ı önceki testin çağrısıyla yalancı pozitif geçer.
beforeEach(() => {
  vi.clearAllMocks();
});

describe('ToolRegistry', () => {
  it('geçerli argümanla çalışır', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'topla',
      description: 't',
      schema: z.object({ a: z.number(), b: z.number() }),
      parameters: { type: 'object' },
      permission: 'safe',
      run: async (args: { a: number; b: number }) => args.a + args.b,
    });
    const r = await reg.execute('topla', '{"a":2,"b":3}', { native });
    expect(r.ok).toBe(true);
    expect(r.result).toBe(5);
  });

  it('bozuk JSON reddedilir', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'x',
      description: 'x',
      schema: z.object({}),
      parameters: {},
      permission: 'safe',
      run: async () => 1,
    });
    const r = await reg.execute('x', 'gecersiz', { native });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('JSON');
  });

  it('şemaya uymayan argüman reddedilir (ekstra alan dahil)', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'x',
      description: 'x',
      schema: z.object({ a: z.string() }).strict(),
      parameters: {},
      permission: 'safe',
      run: async () => 1,
    });
    const r = await reg.execute('x', '{"a":"ok","sinsi":"alan"}', { native });
    expect(r.ok).toBe(false);
  });

  it('bilinmeyen tool reddedilir', async () => {
    const reg = new ToolRegistry();
    const r = await reg.execute('yok', '{}', { native });
    expect(r.ok).toBe(false);
  });

  it('handler hatası ToolResult olur, throw etmez', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'patla',
      description: 'p',
      schema: z.object({}),
      parameters: {},
      permission: 'safe',
      run: async () => {
        throw new Error('gerçek hata');
      },
    });
    const r = await reg.execute('patla', '{}', { native });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('gerçek hata');
  });

  it('secret içeren hata mesajı maskelenir', async () => {
    const reg = new ToolRegistry();
    const fake = 'sk-' + 'abcdef1234567890abcdef';
    reg.register({
      name: 'p',
      description: 'p',
      schema: z.object({}),
      parameters: {},
      permission: 'safe',
      run: async () => {
        throw new Error(`anahtar: ${fake}`);
      },
    });
    const r = await reg.execute('p', '{}', { native });
    expect(r.error).not.toContain('abcdef1234567890abcdef');
    expect(r.error).toContain('[REDACTED]');
  });

  it('abort listener fn çözülünce kaldırılır (V1.2-117)', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'hizli',
      description: 'h',
      schema: z.object({}),
      parameters: {},
      permission: 'safe',
      run: async () => 1,
    });
    const controller = new AbortController();
    const r = await reg.execute('hizli', '{}', { native, signal: controller.signal });
    expect(r.ok).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('zaten iptal edilmiş signalde araç çalışmaz (V1.2-118)', async () => {
    const reg = new ToolRegistry();
    const runSpy = vi.fn(async () => 1);
    reg.register({
      name: 'calismasin',
      description: 'c',
      schema: z.object({}),
      parameters: {},
      permission: 'safe',
      run: runSpy,
    });
    const controller = new AbortController();
    controller.abort();
    const r = await reg.execute('calismasin', '{}', { native, signal: controller.signal });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('iptal');
    expect(runSpy).not.toHaveBeenCalled();
  });
});

describe('summarizeArgs — onay özeti (V1.2-009)', () => {
  it('JSON argümanı tek satırda özetler, uzun metni kırpar', () => {
    expect(summarizeArgs('{"name":"not defteri"}')).toBe('{"name":"not defteri"}');
    const long = summarizeArgs(`{"text":"${'a'.repeat(500)}"}`, 50);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith('…')).toBe(true);
  });

  it('secret desenlerini maskeler', () => {
    const out = summarizeArgs('{"key":"sk-abcdef1234567890abcdef"}');
    expect(out).not.toContain('abcdef1234567890abcdef');
    expect(out).toContain('[REDACTED]');
  });

  it('JSON olmayan metni de maskeler', () => {
    expect(summarizeArgs('api_key=supersecret123')).toContain('[REDACTED]');
  });
});

describe('builtin tools', () => {
  it('sysinfo gerçek native veriyi döner', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const r = await reg.execute('sysinfo', '{}', { native });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.result)).toContain('win32');
  });

  it('open_app allowlist dışı uygulamayı reddeder', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const r = await reg.execute('open_app', '{"name":"kötücül.exe"}', { native });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('izinli');
    expect(native.openApp).not.toHaveBeenCalled();
  });

  it('open_app Türkçe adları gerçek uygulamaya çevirir', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const r = await reg.execute('open_app', '{"name":"not defterini aç"}', { native });
    expect(r.ok).toBe(true);
    expect(native.openApp).toHaveBeenCalledWith('notepad');
  });

  it('open_app izinli İngilizce adı açar', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const r = await reg.execute('open_app', '{"name":"notepad"}', { native });
    expect(r.ok).toBe(true);
    expect(native.openApp).toHaveBeenCalledWith('notepad');
  });

  it('open_url sadece http/https kabul eder', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const bad = await reg.execute('open_url', '{"url":"file:///etc/passwd"}', { native });
    expect(bad.ok).toBe(false);
    expect(native.openUrl).not.toHaveBeenCalled();
    const good = await reg.execute('open_url', '{"url":"https://example.com"}', { native });
    expect(good.ok).toBe(true);
  });

  it('not_al dosya adını güvenli hale getirir', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    const r = await reg.execute('not_al', '{"title":"rapor: 2026/10","content":"içerik"}', {
      native,
    });
    expect(r.ok).toBe(true);
    expect(native.writeNote).toHaveBeenCalledWith(
      expect.stringContaining('rapor: 2026/10'),
      expect.stringMatching(/^rapor_2026_10\.md$/),
      '/secim',
    );
    expect(native.rememberNotesDirectory).toHaveBeenCalledWith('/secim');
  });

  it('not_al: modelin var olmayan klasörünü yok sayar, seçiciye düşer', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    vi.mocked(native.folderExists).mockResolvedValueOnce(false);
    const r = await reg.execute(
      'not_al',
      '{"title":"a","content":"b","directory":"Z:/olmayan-yol"}',
      { native },
    );
    expect(r.ok).toBe(true);
    expect(native.writeNote).toHaveBeenCalledWith(expect.any(String), 'a.md', '/secim');
  });

  it('not_al: hatırlanan klasör varsa kullanıcıya sormaz', async () => {
    const reg = new ToolRegistry();
    for (const t of createBuiltinTools()) reg.register(t);
    vi.mocked(native.getNotesDirectory).mockResolvedValueOnce('/hatir');
    vi.mocked(native.pickDirectory).mockClear();
    const r = await reg.execute('not_al', '{"title":"m","content":"n"}', { native });
    expect(r.ok).toBe(true);
    expect(native.writeNote).toHaveBeenCalledWith(expect.any(String), 'm.md', '/hatir');
    expect(native.pickDirectory).not.toHaveBeenCalled();
  });

  it('clipboard_yaz onay gerektirir (V1.2-069)', async () => {
    const def = createBuiltinTools().find((t) => t.name === 'clipboard_yaz');
    expect(def?.requiresConfirmation).toBe(true);
    // Onay fonksiyonu yoksa izin katmanı reddeder — pano sessizce ezilemez.
    const pm = new PermissionManager();
    const r = await pm.check('clipboard_yaz', def!.permission, def!.requiresConfirmation, '{}');
    expect(r.allowed).toBe(false);
    expect(native.clipboardWrite).not.toHaveBeenCalled();
  });
});

describe('PermissionManager', () => {
  it('readOnly modda low-risk/sensitive engellenir', async () => {
    const pm = new PermissionManager({ readOnly: true });
    expect((await pm.check('t', 'safe', false, {})).allowed).toBe(true);
    expect((await pm.check('t', 'low-risk', false, {})).allowed).toBe(false);
    expect((await pm.check('t', 'sensitive', false, {})).allowed).toBe(false);
  });

  it('confirm yoksa sensitive reddedilir', async () => {
    const pm = new PermissionManager();
    const r = await pm.check('t', 'sensitive', true, {});
    expect(r.allowed).toBe(false);
  });

  it('confirm false ise reddedilir, true ise izin verilir', async () => {
    const pm = new PermissionManager({ confirm: async () => false });
    expect((await pm.check('t', 'sensitive', true, {})).allowed).toBe(false);
    const pm2 = new PermissionManager({ confirm: async () => true });
    expect((await pm2.check('t', 'sensitive', true, {})).allowed).toBe(true);
  });

  it('onay fonksiyonuna ham argüman iletilir (özet agent-service tarafında)', async () => {
    const confirm = vi.fn(async () => true);
    const pm = new PermissionManager({ confirm });
    await pm.check('clipboard_yaz', 'low-risk', true, '{"text":"merhaba"}');
    expect(confirm).toHaveBeenCalledWith('clipboard_yaz', '{"text":"merhaba"}');
  });
});
