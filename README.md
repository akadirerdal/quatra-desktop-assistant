# Quatra — Masaüstü Yapay Zeka Asistanı

Minimal, ses-öncelikli, gerçek tool-calling yapabilen masaüstü asistan.
Electron + Vite + React + TypeScript (strict). AI sağlayıcı: **DeepSeek** (birincil), Groq adaptörüne hazır arayüz.

> Bu README **gerçek implementasyonu** anlatır. Çalışmayan hiçbir özellik "çalışıyor" diye yazılmaz.

## Mimari

```
electron/            # main (Node): IPC, credentials (safeStorage), agent servisi, native köprü
src/providers/       # ProviderAdapter arayüzü + DeepSeek client (stream, retry, timeout, tool-calls)
src/features/
  agent/             # tool-calling döngüsü (supervisor: iterasyon limiti, iptal, timeout)
  tools/             # registry (zod doğrulama), permissions, builtin tool'lar
  assistant/         # visualizer durum makinesi, ana ekran, controller
  audio/             # mic capture + GERÇEK seviye analizi, STT (Web Speech), TTS (speechSynthesis)
  settings/          # 8 kategori ayar paneli
src/state/           # zustand store'lar (settings zod-şemalı, assistant)
src/services/        # log (redact'lı ring-buffer), storage backend'leri
tests/unit/          # 79 test — GERÇEK API anahtarı gerekmez
docs/                # platform matrisi
```

Güvenlik sınırları: renderer'da Node yok; API anahtarı yalnızca `safeStorage` kasasında (Windows DPAPI / macOS Keychain) ve yalnızca main süreçte okunur; loglar redact sınırından geçer; model/web/dosya içeriği veridir, komut değildir; shell erişimi YOK.

## Ön koşullar

- Node.js ≥ 22 (Windows / macOS)
- Windows veya macOS (bu geliştirmede yalnızca Windows doğrulandı — bkz. `docs/platform-matrix.md`)

## Kurulum ve geliştirme

```bash
npm install
npm run dev           # yalnız renderer (tarayıcıda)
npm run dev:electron  # Electron + Vite (canlı geliştirme)
npm run verify        # typecheck + lint + 81 test + secret taraması (kapı)
npm run build         # üretim derlemesi (dist + dist-electron)
npm run package:win   # Windows NSIS kurulumu (release/)
```

Pencere: özel başlık çubuğu (menü yok) — **─ küçült / □ büyüt-geri al / ✕ kapat**; ilk açılışta **tam ekran** (F11 ile çık/gir).

Alt çubukta iki pill (OpenCode tarzı): **model seçici** (sağlayıcıdan gerçek liste) ve **çalışma modu** (Hızlı / Düşünceli).

## DeepSeek yapılandırması

1. Uygulamayı aç → "Quatra'yı kur" → Ayarlar → **AI Sağlayıcı**.
2. DeepSeek API anahtarını yapıştır → **Kaydet** (anahtar şifre kasasına gider, dosyaya açık yazılmaz).
3. **Test et** — gerçek bir istek atılır; yeşil yanmadan "bağlı" sayılmaz.
4. **Modelleri getir** — gerçek model listesi çekilir; listede olmayan model gösterilmez.

Varsayılan modeller: Sohbet `deepseek-chat` (hızlı) / Yazılım `deepseek-reasoner` (derin).
Mod geçişi: sesli "yazılım moduna geç" / "normal moda geç" / "mod değiştir" veya ekrandaki model göstergesine tıklayarak.

## Mikrofon ve ses

- Mikrofon izni yalnızca ses özelliğini kullandığında istenir.
- STT: tarayıcının Web Speech motoru (tr-TR). TTS: sistem `speechSynthesis`.
- Görsel (visualizer) mikrofon seviyesini **gerçek sinyalden** alır; uydurma animasyon yoktur.
- Konuşma çıkış sinyaline erişilemediği için konuşma animasyonu dürüst bir nefes dalgasıdır (analyser kancası hazır).

## Araçlar (tool) ve izinler

`sysinfo`, `open_app` (allowlist), `open_url` (yalnız http/https), `not_al` (seçili klasöre markdown not), `clipboard_yaz`, `clipboard_oku` (onaylı).

Üç seviye: safe (serbest) / low-risk / sensitive (onay dialogu). İzinler native katmanda uygulanır; model kendi iznini genişletemez.

## Güvenlik notları

- API anahtarı: `safeStorage` ile şifrelenir; renderer yalnızca "var/yok" bilir.
- `npm run verify` içinde secret taraması (`scripts/check-secrets.mjs`) koşar.
- Konuşma metinleri varsayılan olarak saklanmaz (ayarlanabilir).
- Ses kaydı tutulmaz; yalnızca anlık tanıma yapılır.

## Testler

```bash
npm run test          # 79 unit/component testi — credentials'sız, mock ağ
npm run verify        # tam kapı
```

Gerçek anahtarlı uçtan uca doğrulama: uygulamayı kur, anahtarı gir, "Test et" + bir sohbet + "bilgisayar bilgisi ver" komutunu dene.

## Bilinen sınırlamalar (dürüst liste)

- Streaming yanıtları tek parça gelir (provider stream kodu hazır; UI delta P2).
- Wake-word motoru kurulu değil — ayarlarda "kullanılamaz" işaretlidir (PTT + elle tetikleme çalışır).
- Sistem ses seviyesi kontrolü yok (desteklenmiyor olarak dürüstçe işaretli).
- Global kısayol şimdilik yalnızca pencere odaktayken çalışır (FAZ 7'de `globalShortcut`).
- Uygulama ikonu varsayılan (özel ikon P2).
- macOS doğrulanmadı (unverified) — bkz. `docs/platform-matrix.md`.

## Yol haritası

Tüm plan ve durum `TODO.md`'dedir (tek plan kaynağı).
