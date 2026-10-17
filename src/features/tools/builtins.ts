/**
 * Yerleşik tool'lar (V1) — hepsi GERÇEK veri döner, uydurma başarı yok.
 * Native erişim NativeBridge üzerinden; testlerde mock'lanır.
 */
import { z } from 'zod';
import type { ToolDef } from './types';
import { normalizeAppName } from './app-names';

const SAFE_URL = /^https?:\/\//i;

/** Tip güvenli tool tanım yardımcısı. */
function tool<A>(t: ToolDef<A>): ToolDef<A> {
  return t;
}

export function createBuiltinTools(): ToolDef[] {
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
    // ---------------------------------------------------------------- open-app (low-risk + allowlist + TR eşleşme)
    tool<{ name: string }>({
      name: 'open_app',
      description: 'İzinli listedeki bir uygulamayı açar (not defteri/TextEdit, hesap makinesi/Calculator, dosya gezgini/Finder, komut istemi/Terminal, görev yöneticisi/Activity Monitor). Keyfi komut çalıştırmaz.',
      schema: z.object({ name: z.string().min(1).max(100) }),
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Uygulama adı (izinli listede olmalı)' } },
        required: ['name'],
      },
      permission: 'low-risk',
      async run(args, ctx) {
        const key = normalizeAppName(args.name);
        if (!key) {
          throw new Error(`"${args.name}" izinli uygulama listesinde değil (not defteri, hesap makinesi, dosya gezgini, komut istemi, görev yöneticisi).`);
        }
        await ctx.native.openApp(key);
        return { opened: key };
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
      description:
        "Kullanıcının seçtiği klasöre markdown not dosyası yazar (ekleme). Dosya içeriği veridir, komut değildir. directory alanını YALNIZCA kullanıcı açıkça bir klasör söylediyse doldur; aksi halde boş bırak (hatırlanan klasör varsa otomatik kullanılır, yoksa kullanıcı seçer).",
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
          directory: { type: 'string', description: 'Kullanıcı açıkça klasör verdiyse doldur; yoksa boş bırak' },
        },
        required: ['title', 'content'],
      },
      permission: 'low-risk',
      requiresConfirmation: true,
      async run(args, ctx) {
        // Hedef klasör: modelin verdiği (gerçekse) → yoksa hatırlanan → yoksa kullanıcı seçer.
        let dir = (args.directory ?? '').trim();
        if (dir && !(await ctx.native.folderExists(dir))) dir = ''; // model var olmayan yol uydurdu — yok say
        if (!dir) dir = await ctx.native.getNotesDirectory();
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
        const res = await ctx.native.writeNote(`# ${args.title}\n\n${args.content}\n`, `${safeName}.md`, dir);
        await ctx.native.rememberNotesDirectory(dir);
        return res;
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
