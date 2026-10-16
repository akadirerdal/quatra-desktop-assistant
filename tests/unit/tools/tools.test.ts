import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../../src/features/tools/registry';
import { PermissionManager } from '../../../src/features/tools/permissions';
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
    const r = await reg.execute(
      'not_al',
      '{"title":"rapor: 2026/10","content":"içerik"}',
      { native },
    );
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

  it('allowlist eşleşmesi gevşek çalışır', () => {
    const pm = new PermissionManager();
    expect(pm.isAppAllowed('Notepad')).toBe(true);
    expect(pm.isAppAllowed('notepad.exe')).toBe(true);
    expect(pm.isAppAllowed('kötücül')).toBe(false);
  });
});
