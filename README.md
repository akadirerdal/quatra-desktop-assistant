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

- **Ses tanıma (STT):** Electron'da Chromium'un Web Speech servisi çalışmadığı için sesin **Groq Whisper** ile yazıya çevrilir. Ayarlar → AI Sağlayıcı → **Groq API Anahtarı** alanına console.groq.com'dan aldığın anahtarı ekle (ücretsiz kota yeterli). Ses diske yazılmaz.
- **Sürekli sohbet (varsayılan açık):** Cevap bitince mikrofon kendiliğinden dinlemeye döner — insanla sohbet eder gibi. «Quatra» demene gerek kalmaz; sessiz kalırsan sohbet beklemeye geçer. Ayarlar → Ses ve Giriş'ten kapatılabilir.
- **Konuşma (TTS):** Varsayılan **Edge Neural** — doğal Türkçe sesler (Emel/Ahmet), ücretsiz, internet ister. Çevrimdışıysa otomatik sistem sesine düşer. Konuşma sırasında visualizer dalgası **gerçek çıkış sinyaliyle** çizilir.
- **Uyandırma kelimesi:** «Quatra» (kuatra/quatro/kotra varyantları tanınır). Bas-konuş kısayolu (Ctrl+Shift+Space) globaldir.
- Windows'ta ek sesler gerekirse: Ayarlar → Saat ve Dil → Konuşma → Sesleri ekle.

## Güncelleme ve veri kalıcılığı

- Ayarlar ve API anahtarları `%APPDATA%\Quatra` altında tutulur (eski konumlardan otomatik göç eder).
- Güncelleme/kurulum anahtarları **silmez** (`deleteAppDataOnUninstall: false`).

## Model seviyeleri

Alt çubuktaki model pill'inden seçilir (gerçek preset'ler):

| Seviye | Model | Sıcaklık | Token |
|---|---|---|---|
| Düşük | deepseek-chat | 0.3 | 1024 |
| Varsayılan | deepseek-chat | 0.7 | 2048 |
| Yüksek | deepseek-reasoner | 0.7 | 4096 |
| Max | deepseek-reasoner | 1.0 | 8192 |
| Ultra Max | deepseek-reasoner | 1.2 | 8192 |

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
