# QUATRA — Roadmap (v2, 2026-10-15)

> Asistan adı: **Quatra**. Bu doküman tek plan kaynağıdır.
> Çalışma prensibi: sadece `verify` (typecheck+lint+test) geçen adım ✅ olur. Kırmızıyken sonraki adıma geçilmez.

---

## 0. Proje Durumu Özeti (denetlenmiş, kanıtlı)

**Repo:** `quatra-desktop-assistant` — tek commit: `2d98fb6 Bootstrap Quatra desktop assistant`. Çalışma ağacı temiz.

**Denetim kanıtı:** Tüm `.ts/.tsx/.js/.json/.md` tarandı (node_modules/dist hariç). `deepseek|groq|speech|whisper|getUserMedia|telegram|browser.?use|playwright|puppeteer|fetch(` aramasında **kod dosyalarında sıfır eşleşme** — bulunanlar sadece `TODO.md` plan metinleri.

**Hakimiyet matrisi (raporlanan vs gerçek):**

| Raporlanan özellik | Repo'daki gerçek | Kanıt |
|---|---|---|
| DeepSeek sesli konuşma | ❌ **Yok** | `App.tsx` sadece statik başlık (`src/renderer/App.tsx:1-8`); DeepSeek referansı sıfır |
| Tarayıcı arama + sayfa okuma | ❌ **Yok** | Playwright/Puppeteer/fetch entegrasyonu yok |
| Masaüstü dosya listeleme/düzenleme | ❌ **Yok** | fs dosya-işlem kodu yok; `electron/main.ts` sadece pencere açar |
| Uygulama açma / desktop kontrol | ❌ **Yok** | `shell.open*`, app-registry, izin sistemi yok |

> ⚠️ **Not:** Raporlanan bu 4 özellik muhtemelen bu repo dışında (başka bir proje/`Jarvis Assistant` klasörü) denendi. Bu repoda izleri yok. Bu roadmap **sıfırdan sağlam kurulum** varsayar; dışarıdaki kod taşınacaksa önce bu repoya uyarlanıp test edilmeli.

**Gerçekten var olanlar (✅ kanıtlı):**
- Electron 33 + Vite 6 + React 18 + TS 5.6 strict iskeleti; `electron/main.ts`, `electron/preload.ts` (boş contextBridge)
- `src/core/`: config (statik object), logger (console sarmalayıcı), event-bus (basit pub/sub)
- `src/modules/plugins/plugin-manager.ts`: register/unregister/list/runCommand
- Test: 3 dosya, 7 unit test ✅ yeşil; `npm run verify` ✅; `npm run build` ✅
- CI (`.github/workflows/ci.yml`), `.gitignore` (node_modules/dist hariç); **`.env` koruması yok**

**Kritik riskler (özet):**
1. **Secret sızıntı yüzeyi:** repo'da `.env` ignore edilmiyor; hiçbir credential yönetimi yok. (P0)
2. **Kapsam patlaması:** 10 faz (crypto trading dahil) tek release'e sığmaz → MVP kilitlenmeli. (P0)
3. **Güvenlik:** shell açıklığı, prompt injection koruması, izin sistemi, log redaction hiç yok. (P0)
4. **Yanıltıcı durum riski:** "çalışıyor" sanılan özellikler yok → UI'da sahte bağlantı/ölü buton yasağı baştan enforce edilmeli. (P1)
5. **Tek makine testi:** macOS hiç doğrulanamadı (bu makinede Win). (P2)

**Süreklilik kararları (korunur):** Electron'da kal (Rust yok, prompt istisnası); CSS modules; zustand; i18n sadece tr+en; V1 ses: Web Speech + `speechSynthesis`; izolasyon ilkeleri (bkz §2).

**Sağlayıcı kararı (yeni):** Birincil **DeepSeek** (`deepseek-chat` / `deepseek-reasoner`), ikincil Groq. `ProviderAdapter` interface'i ikisini de kapsar; V1'de sadece DeepSeek adapter'ı çalışır, Groq P2'dir. Model ID'leri hardcode edilmez, gerçek liste çekilip validate edilir.

---

## 1. MVP Tanımı (Faz 0–1 kapsamı — kilitli)

MVP bitti denmesi için: uygulama açılır; API key'i güvenli girer; yazar/söyler, DeepSeek gerçek cevap döner; ses (STT+TTS) çalışır ve kesilebilir; en az **3 gerçek tool** (sysinfo, open-app, not-al) izin sistemiyle tool-calling üzerinden çalışır; hatalar çökmeden yönetilir; Windows'ta çalışır; tüm testler credentials'sız yeşil.

**MVP'ye GİRMEZ:** Telegram, browser automation, desktop mouse/keyboard control, memory, self-improvement, crypto. Bunlar sonraki fazlar.

**Önerilen uygulama sırası:** §2 → Faz 1 → Faz 2 → Faz 3 → Faz 4 → 5 → 6 → 7 → 8 → 9.

---

## 2. §0 Mimari İlkeler — İzolasyon & Optimizasyon (her fazda zorunlu)

1. **Süreç izolasyonu:** main (Node izni) ↔ preload (dar `quatra.*` köprüsü) ↔ renderer (secretsiz). Renderer çökerse pencere reload olur; main + ayarlar korunur. Main'de `uncaughtException` → logla, sessiz kapatma yok.
2. **Modül izolasyonu:** Her feature interface arkasında; bağımlılıklar enjekte edilir; globals yok.
3. **Arıza sınırları:** Feature başına React `ErrorBoundary` (bozuk panel ana ekranı devirmez). Visualizer'da typed transition map (geçersiz geçiş derleme+testte yakalanır).
4. **Dayanıklılık:** Her ağ/donanım çağrısında timeout + bounded retry + circuit-breaker (5 hata → 60sn soğuma). Ayar yazımı atomik (tmp + rename); bozuk config → son sağlam + defaults.
5. **Mic watchdog:** error/shutdown/kesinti sonrası capture kesinlikle serbest bırakılır.
6. **Güvenlik sınırı:** Secret sadece `services/credentials` (OS keychain/keytar; yoksa limit-doc + fallback). Log/diagnostic sınırında otomatik redact. Model/web/dosya içeriği untrusted → prompt injection talimat sayılmaz; shell'e string gömülemez.
7. **Degrade matrisi:** Groq/DeepSeek down → dürüst rozet + setup; offline → "çevrimdışı" (local tool'lar yaşar); mic yok → `muted` + recovery, TTS yaşar; TTS yok → ephemeral caption; bir tool patlarsa o tool `disabled`, diğerleri yaşar.

---

## 3. FAZLAR

### Phase 0 — Audit and Foundation ✅ (2026-10-16)
- [x] **0.1 Repo denetimi** ✅ — hiçbir ürün özelliği yoktu; sıfırdan sağlam kurulum yapıldı.
- [x] **[P0] 0.2 Secret hijyeni** ✅ — `.gitignore` (.env korumalı), `.env.example`, `src/utils/redact.ts` + testler, `scripts/check-secrets.mjs` (`verify` içinde).
- [x] **[P0] 0.3 Sağlayıcı abstraction** ✅ — `src/providers/types.ts` (ProviderAdapter, ProviderError, mapHttpError).
- [x] **[P1] 0.4 Loglama + hata taksonomisi** ✅ — `src/services/log/logger.ts` (seviye + scope + ring-buffer + otomatik redact), `src/types/errors.ts` (QuatraError kategorileri). Not: electron-log yerine bağımlılıksız logger (dosya sink'i FAZ 7'de).
- [x] **[P1] 0.5 Test altyapısı** ✅ — Testing Library + jsdom kurulu; `tests/unit/ui/` component testleri; arıza testleri agent/tool testlerine gömülü.
- [x] **[P1] 0.6 Cross-platform değerlendirme** ✅ — `docs/platform-matrix.md` (macOS unverified etiketli).

**Phase 0 kapısı:** ✅ `verify` yeşil + redact kanıtlı.

---

### Phase 1 — Reliable Core Assistant (MVP'nin kalbi)
- [ ] **[P0] 1.1 DeepSeek adapter (gerçek entegrasyon)**
  - ✅ 2026-10-15 — `src/providers/deepseek/client.ts`: streaming (SSE), timeout + AbortController, 429/5xx bounded-backoff retry, 401/404/429/5xx ayrıştırma, tool_calls parse (normal + stream), testConnection, listModels. 15 mock-network testi (credentials'sız) ✅
- [x] **[P0] 1.2 Gerçek bağlantı testi + model seçimi** ✅ — Settings "Test et" gerçek istek atar (main süreçte), "Modelleri getir" gerçek listModels çağırır; başarısızlık dürüst gösterilir. (Gerçek anahtarla doğrulama kullanıcıda.)
- [x] **[P0] 1.3 Konuşma durumu + cancel** ✅🟡 — `state/assistant-store.ts` (zustand): status/caption/tasks/levels; cancel AbortController'lı (main agent). Not: yanıt tek parça gelir (streaming UI deltası P2 — provider stream kodu hazır + testli).
- [x] **[P0] 1.4 Ses pipeline** ✅🟡 — `features/audio/audio-service.ts`: gerçek getUserMedia + AnalyserNode seviye (micLevel gerçek), Web Speech STT (tr-TR), speechSynthesis TTS, interrupt (stop→cancel→listening), mic watchdog (her yolda release). Not: speechSynthesis çıkış sinyaline erişim yok → speaking'de dürüst nefes dalgası (analyser hook'u hazır).
- [x] **[P0] 1.5 Visualizer + ana ekran** ✅ — 6 durum, typed transition map + testler, canvas RAF, Math.random YOK, reduced-motion, focus kaybında durma. UI testleri jsdom'da.
- [x] **[P1] 1.5b Görev baloncuğu** ✅ — saydam köşe balonu, running→done→4sn sonra kaybolma; UI testli.
- [x] **[P1] 1.5c Model göstergesi + mod sistemi** ✅ — alt çubukta **iki pill** (OpenCode tarzı): model seçici (gerçek model listesi dropdown) + çalışma modu (Hızlı/Düşünceli dropdown); "yazılım moduna geç / normal moda geç / mod değiştir" sesli komutları; UI testli.
- [x] **[P1] 1.5e Özel pencere çubuğu** ✅ — `Menu.setApplicationMenu(null)` (File/Edit kaldırıldı) + `frame:false`; sürüklenebilir şerit + ─ □ ✕ butonları (IPC: window:minimize/toggle-maximize/close); ilk açılış tam ekran.
- [x] **[P1] 1.5d Sade simge kuralı** ✅ — küçük soluk simgeler, "göster" metin alternatifi.
- [x] **[P0] 1.6 Tool-calling çekirdeği + tool'lar** ✅ — `features/tools/registry.ts` (zod validate → permission → per-tool timeout → structured ToolResult), `permissions.ts` (safe/low-risk/sensitive + allowlist + readOnly + confirm), `features/agent/loop.ts` (max-iteration, cancel, timeout). 6 builtin tool: sysinfo, open_app (allowlist), open_url (http/https), not_al, clipboard_yaz, clipboard_oku. 23 tool/agent testi.
- [x] **[P1] 1.7 Settings V1** ✅ — 8 kategori; zod-validated store; IPC üzerinden atomik JSON + .bak recovery; restore-defaults onaylı; key girişi + göster/gizle + safeStorage kasası; first-run daveti (key yoksa, sahte "bağlı" yok).

**Phase 1 kapısı:** ✅ `verify` (79 test) + `build` + paketlenmiş uygulama smoke testi (win-unpacked çalıştı). Gerçek API anahtarıyla uçtan uca doğrulama: kullanıcıya kaldı (integration).

---

### Phase 2 — Browser and Desktop Agent
> Önce hazır çözüm değerlendirmesi (karar sırası): **Playwright** (verimli, bakımlı, Win+mac) öncelikli; `browser-use` (Python/LLM-orkestrasyon) API ve lisans yeniden değerlendirilir; MCP tabanlı desktop araçları uyumluluk kontrolünden geçer. DeepSeek tool-calling formatı hepsiyle test edilmeden adapter yazılmaz.

- [ ] **[P1] 2.1 Playwright köprüsü (izole browser servisi)**
  - Browser ayrı child-process'te; çökerse asistan yaşar. Sadece `open-url/goto/read-text/screenshot` ile başlanır; her adım izinli (`low-risk`).
  - Acceptance: URL açılır, gerçek DOM metni okunur (uydurma yok), screenshot dosyaya yazılır; browser crash → agent hatası + recovery.
  - Verification: mock-site ile unit + canlı test. Platform: Both.
- [ ] **[P1] 2.2 Sayfa okuma + içerik özeti (untrusted)**
  - Okunan sayfa içeriği modele **veri** olarak gider; içindeki talimatlar uygulanmaz (injection testi yazılır).
  - Acceptance: injection senaryosunda tool çağrılmaz; çıktı kaynak-url ile birlikte raporlanır. Verification: `tests/fault/prompt-injection.test.ts`. Platform: Both.
- [ ] **[P2] 2.3 Screenshot + görsel analiz** — model destekliyorsa (`vision` uyumluluk kontrolü DeepSeek'te doğrulanır; yoksa dürüst "unsupported"); ekran görüntüsü al → analiz → rapor. Verification: gerçek screenshot + model cevabı. Platform: Both.
- [ ] **[P2] 2.4 Desktop kontrol v1 (güvenli çekirdek)** — `open-app` genişletme: pencere odakla/öne getir (native); mouse/keyboard otomasyonu YALNIZ `sensitive` + açık onay + allowlist ile; her adım öncesi/sonrası doğrulama (ekran/odak kontrolü). Platform: Win öncelikli, mac unverified.
- [ ] **[P2] 2.5 Dosya yönetimi v1 (izinli)** — `file-list/search/move/rename/copy` → `sensitive` onaylı; kök dizin seçimi kullanıcı dialog'uyla; işlem öncesi plan + işlem sonrası verify (dosya var mı, boyut hash); geri alınabilirlik: taşıma günlüğü + undo. Verification: temp dizinde uçtan uca test + fault (kesme/çakışma). Platform: Both.
- [ ] **[P2] 2.6 Çok adımlı görev + ilerleme raporu** — Agent plan → adım adım execute → her adım `AgentEvent` ile UI'ya; hata → kısmi sonuç raporu + recovery önerisi. Verification: 3 adımlı senaryo testi (1 adımı kasıtlı fail). Platform: Both.

---

### Phase 3 — Memory and Personalization
- [ ] **[P1] 3.1 Kısa süreli bağlam** — session context + clear; token bütçesi ile kırpma. Verification: context trim testleri.
- [ ] **[P2] 3.2 Tercihler** — ayarlardan beslenen kişiselleştirme (isim, ton, dil). Settings V1 üstüne. Verification: persistence testleri.
- [ ] **[P2] 3.3 Uzun süreli hafıza (opt-in)** — lokal SQLite: kayıt **kullanıcı onaylı**; UI'da "Quatra şunu hatırlıyor" listesi; silme/düzenleme tek tıkla; hafıza kullanımı net etiketli ("hatırlıyorum" != "öğrendim/train ettim").
  - Acceptance: hafıza sadece opt-in'de yazılır; silme gerçekten kalıcı; export secretsiz. Verification: CRUD + silme testleri. Platform: Both.
- [ ] **[P3] 3.4 Alaka tabanlı getirme** — basit embedding/anahtar eşleşme; kalite ölçümü için 10 senaryoluk eval seti.

---

### Phase 4 — Security and Reliability
- [ ] **[P0] 4.1 İzin çekirdeği sıkılaştırma** — sensitive her zaman onay; shell **varsayılan kapalı**; allowlist dışı open-app red; native-layer enforce; bypass deneme testleri (farklı tool adı/bozuk arg).
- [ ] **[P0] 4.2 Prompt injection savunması (site + dosya + tool çıktısı)** — tüm dış içerik untrusted; sistem prompt'unda sert sınır; injection test paketi.
- [x] **[P0] 4.3 Secret yönetimi final** ✅ (kısmen erken tamamlandı) — Electron `safeStorage` (Windows DPAPI / macOS Keychain) ile şifreli kasa (`electron/credentials.ts`); anahtar renderer'a asla dönmez; redact testleri + `check:secrets` CI taraması var. keytar gerekmedi.
- [ ] **[P1] 4.4 Audit log + yıkıcı işlem onayları + file backup/undo** — her sensitive işlem kaydı (redact'lı); silme/taşımada otomatik yedek (`.quatra-backup/`) + undo.
- [ ] **[P2] 4.5 Sandboxed kod koşturma** — yalnız izole süreç/klasör, süre limiti, ağ kapalı; "run_code" tool'u bu kuralların dışına çıkamaz. (V1'de YOK; iskelet plan.)
- [x] **[P0] 4.6 Yetkisiz davranış testleri** ✅ (kısmen erken) — bilinmeyen tool reddi, bozuk/ekstra arg reddi, onaysız sensitive reddi, allowlist dışı uygulama reddi, URL şema denetimi testli. (Injection paketi Phase 2.2'de derinleşecek.)

---

### Phase 5 — Telegram and Remote Access
- [ ] **[P2] 5.1 Bot iskeleti** — long-polling; **desktop Telegram'sız tam çalışır** (opsiyonel servis; çökse bile app etkilenmez).
- [ ] **[P2] 5.2 Kimlik doğrulama** — yalnız allowlisted chat-ID; diğerleri reddedilir + loglanır; rate limit.
- [ ] **[P2] 5.3 Uzak görev** — task submit → durum (kuyrukta/çalışıyor/bitti/hata) → sonuç teslimi; uzun görevler için iş yönetimi + zaman aşımı; offline'da kuyruk + yeniden bağlanma.
- [ ] **[P3] 5.4 Sesli mesaj** — STT'ye besle; TTS sonucu ses olarak geri (uygunduğunda).

---

### Phase 6 — Cross-Platform Release
- [ ] **[P1] 6.1 Windows paketleme** — electron-builder NSIS; imzasız sürüm uyarısı doc'lu; temiz kurulum testi.
- [ ] **[P2] 6.2 macOS paketleme** — dmg/zip; notarization maliyeti doc'lu; mic/accessibility izinleri; **bu makinede doğrulanamaz → unverified etiketli**.
- [ ] **[P2] 6.3 Platform izinleri ve arka plan** — autostart/start-minimized/tray platform matrisi; desteklenmiyorsa "unavailable".
- [ ] **[P2] 6.4 Config import/export + update mekanizması** — secretsiz export; electron-updater (opsiyonel, yoksa "manual update" doc).
- [ ] **[P1] 6.5 Kurulum/troubleshooting dokümanı + temiz testler** — checklist: temiz VM Win kurulum + smoke; mac için prosedür yazılır, sonuç "unverified" işaretlenir.

---

### Phase 7 — Controlled Self-Improvement
> Kural: asistan kendi çalışan kodunu sessizce değiştiremez; izin sistemini bypass edemez.
- [ ] **[P3] 7.1 Repo analiz araçları** — read-only tarama: TODO taraması, lint/type raporu, test sonucu özeti.
- [ ] **[P3] 7.2 Öneri üretimi** — patch/diff **önerisi** üretir; izole git branch/worktree'de uygular; ana dalı asla doğrudan değiştirmez.
- [ ] **[P3] 7.3 Doğrulama + onay akışı** — branch'te `verify`+test koşar; diff özeti + risk notu sunar; **kullanıcı onayı** olmadan merge/aktivasyon yok; rollback prosedürü (tag/branch) yazılı.

---

### Phase 8 — Cryptocurrency Agent Orchestration (gelecek; MVP dışı)
- [ ] **[P3] 8.1 Read-only veri toplama** — piyasa verisi ajanı; kaynak + timestamp; veri kalitesi kontrolleri.
- [ ] **[P3] 8.2 Backtest + paper trading** — gerçek para YOK; strateji değerlendirme + risk raporu; bağımsız doğrulama ajanı (çapraz kontrol).
- [ ] **[P3] 8.3 Koordinatör + limitler** — pozisyon/exposure limitleri; tüm raporlar tek koordinatörde; **canlı işlem yalnız insan onayıyla** ve ayrı faz; exchange credential'ları secure store'da.

---

### Phase 9 — Advanced Optimization
- [ ] **[P3] 9.1 Model yönlendirme** — basit görev → ucuz model, karmaşık → `deepseek-reasoner`; kural tabanlı, ölçerek açılır. (Not: manuel mod geçişi — Flash/Pro/Max pill + "yazılım moduna geç" komutu — Phase 1.5c'de MVP'ye alındı; burada kalan: görev karmaşıklığına göre OTOMATİK yönlendirme.)
- [ ] **[P3] 9.2 Fallback provider** — Groq adapter'ı ikincil; circuit-breaker devralır.
- [ ] **[P3] 9.3 Maliyet/latency izleme** — token sayacı + gecikme metrikleri; regresyon testleri (kalite düşüşü alarmı).

---

## 4. Definition of Done (her görev için)
1. Kod + test + hata senaryoları + güvenlik etkisi + (gerekliyse) doküman. 2. `npm run verify` yeşil. 3. Kabul kriterleri kanıtlı. 4. Secret/log taraması temiz.
Durum etiketleri: ✅ tamam | 🟡 kısmi | ⛔ blocked | ⬜ başlanmadı.

## 5. Risk Kaydı
| # | Risk | Etki | Önlem | Durum |
|---|---|---|---|---|
| R1 | Kapsam patlaması (10 faz) | Ürün bitmez | MVP kilidi §1 | ✅ planlı |
| R2 | Secret sızıntısı | Ciddi | 0.2 + 4.3 + CI taraması | ⬜ |
| R3 | Prompt injection (web/dosya) | Ciddi | 4.2 test paketi | ⬜ |
| R4 | Sahte "çalışıyor" UI | Güven kaybı | Ölü buton yasağı + 1.2 gerçek testler | ⬜ |
| R5 | Mic sızıntısı (kapanmama) | Gizlilik | watchdog + fault testi | ⬜ |
| R6 | macOS doğrulanamıyor | Release gecikmesi | 6.2/6.5 "unverified" dürüstlüğü | ⬜ |

## 6. Next 3 Tasks to Implement
1. ⬜ **[P2] Phase 2.1–2.2 — Playwright browser köprüsü + untrusted içerik özeti** (sayfa okuma gerçek, injection testli)
2. ⬜ **[P1] Phase 3.1 — Kısa süreli konuşma bağlamı** (session context + clear + token bütçesi)
3. ⬜ **[P1] Phase 4.1–4.4 — İzin sıkılaştırma + audit log + dosya backup/undo**

## 7. Aktif Adım Takibi
- **Tamamlanan:** Phase 0 ✅, Phase 1 ✅ + geri bildirim turları ✅ (2026-10-16):
  - Model seviyeleri, Groq Whisper STT, uyandırma kelimesi, global PTT, sürekli sohbet, Edge Neural TTS, kalıcı veri yolu
  - **Hafıza (yeni):** "hatırla: …" komutu + Ayarlar → Hafıza paneli (liste/sil/temizle/etkinleştirme). Kayıtlar yalnız yerel `memory.json`; ilgili olanlar prompt bağlamına eklenir. 7 test.
  - **Mikrofon filtreleri (yeni):** gerçek getUserMedia kısıtları — gürültü azaltma/yankı önleme/otomatik kazanç + VAD hassasiyeti 1-10. Ayarlar → Ses ve Giriş.
  - **Barge-in (yeni):** Quatra konuşurken sözünü kesersen çalma durur, hemen dinler (GPT voice tarzı). Ayarlardan kapatılabilir.
  - **Log düzeltmeleri:** open_app Türkçe ad eşlemesi (not defteri, hesap makinesi, görev yöneticisi…), tool HATA detayları loglanır, agent model/süre logu, ses hattı olay logları (mic açılış filtreleri, kayıt sonu, STT sonucu, TTS motoru + fallback, barge olayları), renderer → main log köprüsü (info/warn/error).
- **Kanıt:** 126 test ✅, paketli smoke ✅ (log: filtreler A/A/A + uyandırma döngüsü kayıtlı), kurulum masaüstünde
- **Şu an:** Phase 2'ye geçilebilir.

### Geri Bildirim Turları — 2026-10-16 (gece, devam)

**Tur 2 (barge + hafıza v2):** barge-in zaman tabanı hatası düzeltildi (Date.now↔performance.now karışımı); uyandırma sonrası komut devri ("quatra hatırla: …"); "Efendim?" karşılaması; kısa yanıt varsayılanı + detay bayrağı; hafıza: `hafiza_kaydet` tool + "adım ne?" yerel yanıt. 137 test.

**Tur 3 (hafıza v3 — mem0):** model tool'u unutsa bile konuşma sonrası garantili çıkarım; GitHub **mem0** (67K ⭐, Apache-2.0) REST entegrasyonu — opsiyonel "mem0" motoru (Ayarlar → Hafıza; anahtar kasada); çöp ad kayıtları açılışta temizlenir; isim kaydı değiştirme usulü. 149 test.

**Tur 4 (hafıza v4 — "insan gibi hatırla"):** geri bildirim: "her şeyi kaydediyor, 'Hatırladım' diyor, istekleri yanlış anlıyor".
- **Sessiz öğrenme:** sistem prompt + tool talimatı — kayıt işlemi kullanıcıya asla bildirilmez ("hatırladım/not aldım" yasak); yerel onay "Aklımda ✓".
- **Kalite kapıları:** `hasMemorySignal` (kişisel sinyal yoksa çıkarım çağrısı hiç yapılmaz) + katı `EXTRACTION_PROMPT` (KAYDET/KAYDETME listeleri) + `isGarbageEntry` + `isNearDuplicate` (yakın tekrar engeli) + tekil kayıt güncelleme (isim/yaş/meslek… eskisini değiştirir).
- **Ayarlar:** "Konuşmalardan otomatik öğren" anahtarı (varsayılan açık) — `memory.autoLearn`.
- **Komut ayrıştırma:** "unutma"/"not al" eklendi; "hatırladın mı?" gibi sorular kayıt sayılmaz (yanlış anlama azaltıldı).
- **Kanıt:** 156 test ✅
