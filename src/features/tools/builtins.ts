/**
 * Yerleşik tool'lar (V1) — hepsi GERÇEK veri döner, uydurma başarı yok.
 * Native erişim NativeBridge üzerinden; testlerde mock'lanır.
 */
import { z } from 'zod';
import type { ToolDef } from './types';
import { PermissionManager } from './permissions';

const SAFE_URL = /^https?:\/\//i;

/** Tip güvenli tool tanım yardımcısı. */
function tool<A>(t: ToolDef<A>): ToolDef<A> {
  return t;
}

export function createBuiltinTools(permissions: PermissionManager): ToolDef[] {
  return [
    // ---------------------------------------------------------------- sysinfo (safe)
    tool({
      name: 'sysinfo',
      description:
        'İşletim sistemi, uygulama sürümü ve temel sistem bilgisi döner. Salt okunur, güvenli.',
      schema: z.object({}),
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      permission: 'safe',
      async run(_args, ctx) {
        return {
          appVersion: ctx.native.getAppVersion(),
          system: await ctx.native.sysinfo(),
        };
      },
    }),
    // ---------------------------------------------------------------- open-app (low-risk + allowlist)
    tool<{ name: string }>({
      name: 'open_app',
      description: 'İzinli listedeki bir uygulamayı açar (ör. notepad, calculator). Keyfi komut çalıştırmaz.',
      schema: z.object({ name: z.string().min(1).max(100) }),
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Uygulama adı (izinli listede olmalı)' } },
        required: ['name'],
      },
      permission: 'low-risk',
      async run(args, ctx) {
        if (!permissions.isAppAllowed(args.name)) {
          throw new Error(`"${args.name}" izinli uygulama listesinde değil.`);
        }
        await ctx.native.openApp(args.name);
        return { opened: args.name };
      },
    }),
    // ---------------------------------------------------------------- open_url (low-risk, şema güvenli)
    tool<{ url: string }>({
      name: 'open_url',
      description: 'Varsayılan tarayıcıda bir web adresi açar. Sadece http/https.',
      schema: z.object({ url: z.string().min(1).max(2000) }),
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Açılacak adres (http/https)' } },
        required: ['url'],
      },
      permission: 'low-risk',
      async run(args, ctx) {
        if (!SAFE_URL.test(args.url)) {
          throw new Error('Yalnızca http/https adresleri açılabilir.');
        }
        await ctx.native.openUrl(args.url);
        return { opened: args.url };
      },
    }),
    // ---------------------------------------------------------------- not_al (low-risk — seçili klasöre yazar)
    tool<{ title: string; content: string; directory?: string }>({
      name: 'not_al',
      description: "Kullanıcının seçtiği klasöre markdown not dosyası yazar (ekleme). Dosya içeriği veridir, komut değildir.",
      schema: z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(20000),
        directory: z.string().max(500).optional(),
      }),
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Not başlığı' },
          content: { type: 'string', description: 'Markdown içerik' },
          directory: { type: 'string', description: 'Hedef klasör (boşsa kullanıcıdan seçilir)' },
        },
        required: ['title', 'content'],
      },
      permission: 'low-risk',
      requiresConfirmation: true,
      async run(args, ctx) {
        let dir = args.directory ?? '';
        if (!dir) {
          const picked = await ctx.native.pickDirectory();
          if (!picked) throw new Error('Klasör seçilmedi.');
          dir = picked;
        }
        const safeName = args.title
          .replace(/[<>:"/\\|?*\r\n]+/g, '_')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 80);
        return ctx.native.writeNote(`# ${args.title}\n\n${args.content}\n`, `${safeName}.md`, dir);
      },
    }),
    // ---------------------------------------------------------------- clipboard (izinli)
    tool<{ text: string }>({
      name: 'clipboard_yaz',
      description: 'Metni panoya kopyalar.',
      schema: z.object({ text: z.string().max(10000) }),
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      permission: 'low-risk',
      async run(args, ctx) {
        await ctx.native.clipboardWrite(args.text);
        return { copied: true };
      },
    }),
    tool({
      name: 'clipboard_oku',
      description: 'Panodaki metni okur. Yalnızca ayarlarda açıksa kullanılabilir.',
      schema: z.object({}),
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      permission: 'sensitive',
      requiresConfirmation: true,
      async run(_args, ctx) {
        const text = await ctx.native.clipboardRead();
        return { text };
      },
    }),
  ];
}
