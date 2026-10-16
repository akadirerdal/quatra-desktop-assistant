# QUATRA — Roadmap (v2, 2026-10-15)

> Asistan adı: **Quatra**. Bu doküman tek plan kaynağıdır.
> Çalışma prensibi: sadece `verify` (typecheck+lint+test) geçen adım ✅ olur. Kırmızıyken sonraki adıma geçilmez.
> **Çalışma modu (2026-10-16, kullanıcı kararı):** Geliştirme bundan sonra **kaynak koddan** yürür (`npm run dev:electron`) — her turda paketleme YOK. NSIS kurulum dosyası yalnızca ürün bitince üretilir. Tur döngüsü: kod → `npm run verify` → dev uygulamada kullanıcı testi.
> **Masaüstü başlatıcı:** `Quatra.lnk` (masaüstü) → `scripts/quatra-baslat.vbs` → gizli `npm run dev:electron`. Zaten açıksa uyarır; pencereyi kapatınca tüm süreçler kendiliğinden durur. İkon `build/icon.ico` (`node scripts/make-icon.mjs` ile üretilir; final kurulum paketlemesi de bunu kullanır).

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

**Tur 5 (kullanım kılavuzu PDF):** kullanıcı hafızayı onayladı ("hafıza da çalışıyor, güzel oldu") ve "neyin nerede çalıştığını" öğrenebilmek için tüm yapılanları kapsayan bir PDF istedi.
- `scripts/quatra-kilavuz.py` (reportlab + Windows Arial — Türkçe karakterler gömülü) → `docs/Quatra-Kullanim-Kilavuzu.pdf` (~120 KB): ekran rehberi, sesli kullanım akışı, gerçek yetenekler + model seviyeleri, hafıza sistemi, 8 ayar bölümü, veri/gizlilik yerleşimi, sorun giderme tablosu, dürüst sınırlar, hızlı komut kartı, teknik kod haritası.
- PDF masaüstüne kopyalandı (`Quatra-Kullanim-Kilavuzu.pdf`); kılavuz her sürümde `python scripts/quatra-kilavuz.py` ile yeniden üretilir.

**Tur 6 (eksikler listesi):** kullanıcı talimatı: "not al — eksikleri not ediyorsun".
- `EKSIKLER.md` oluşturuldu (repo kökü): sesli deneyim, konuşma anlayışı, araçlar, hafıza, arayüz, güvenlik, platform, altyapı başlıklarında bilinen tüm eksikler + "kullanıcı incelemesinden gelenler" bölümü + ✅ çözülenler bölümü.
- Kural: kullanıcı inceleme sırasında eksik bildirdikçe buraya işlenir; çözülen madde ✅ bölümüne taşınır.

**Tur 7 (inceleme bildirimleri — yalnız not):** kullanıcı "şimdilik sadece not et" dedi; bu turda kod değişikliği YOK.
- Bildirimler (EKSIKLER.md §9'a işlendi): mikrofon ayarları artırılsın + mikrofon testi; kazanç/gürültü engelleme açık-kapalı yerine kademeli; mikrofon sürekli açık, yalnız "Quatra" tetiklesin, uykuya geçmeyi reddetmesin; sessizlikte uyku süresi ayarlanabilir olsun (varsayılan 5 sn); daha fazla tema (tartışma); mikrofon kapatma simgesi yenilenecek (tartışma); Windows açılışında otomatik başlatma (Ayarlar'dan aç/kapat); izin istekleri sözlü olsun — ekranda baloncuk çıkmasın.
- Geliştirici v1 öncelik önerisi EKSIKLER.md başına eklendi: bağlam, hatırlatıcı, akış+sus, yerel uyandırma, yedek sağlayıcı, tepsi+otomatik başlatma, kurulum+güncelleme, audit+yedek, maliyet.
- Doğrulanan mevcut durum: mikrofon cihazı seçimi yok (varsayılan cihaz); takip süreleri sabit kod içinde (ayarlanabilir değil).

**Tur 8 (Vol 1 Update listesi):** kullanıcı "vol 1 update olarak bi liste oluştur ve burdaki tüm maddeleri ekle" dedi.
- `V1-UPDATE.md` oluşturuldu: 21 numaralı madde, 7 paket halinde (A mikrofon, B sesli deneyim, C zeka, D arka plan, E görsel, F güvenlik, G dağıtım) + H "v1'de değerlendirilecek" + I "kapsam dışı".
- Kaynak etiketleri: 👤 kullanıcı bildirimi, 🔧 geliştirici tespiti; her madde tamamlanınca ✅ + EKSIKLER.md ile senkron.
- EKSIKLER.md v1 bölümü ve §9, V1-UPDATE.md'ye bağlandı (tek doğru kaynak).

**Tur 9 (E paketi — tema sistemi + MIC konseptleri):** kullanıcı "E paketinden başlayalım" dedi.
- **Tema sistemi (V1-15):** `src/renderer/themes.ts` — 7 hazır tema (Gece Moru, Okyanus, Zümrüt, Gün Batımı, Gül, Grafit, Şafak) + saf yardımcılar (`mixHex`, `accentFamily`, `buildThemeVars`, `applyAppearance`); şema `appearance.theme`; Ayarlar → Görünüm'de tema seçici (tema seçimi vurguyu da temaya döndürür; alttan ince ayar yapılabilir).
- **Ölü kontroller bulundu ve düzeltildi:** (1) vurgu rengi CSS'e hiç uygulanmıyordu — yalnız canvas'a gidiyordu; (2) "Arayüz ölçeği" hiçbir yere bağlı değildi; (3) "Hareketi azalt" yalnız canvas'ı etkiliyordu. Artık üçü de gerçek: CSS değişkenleri + `body zoom` + `reduced-motion` sınıfı.
- **Stil:** sabit vurgu/panel rgba'ları değişkenleştirildi (`color-mix`, `--glass`, `--overlay`, `--on-accent`); Visualizer'daki sabit renkler temaya bağlandı (#b9acf5 → türetilmiş parlak vurgu, #5a5d6e → tema muted). Şafak (aydınlık) tema dahil — aydınlık kontrast turu kullanıcıyla yapılacak.
- **MIC simgesi (V1-16):** 4 animasyonlu konsept → `docs/mic-onerileri.html`; kullanıcı **C · Ekolayzır**'ı seçti.
- **C konsepti uygulandı:** `mic-eq.ts` (saf seviye matematiği) + `MicButton.tsx` — dinlerken çubuklar gerçek mikrofon seviyesiyle oynar, konuşurken gerçek çıkış sinyali (yoksa sakin sabit desen), kapalıyken kırmızıya çöker; "Hareketi azalt" açıkken sabit desen. Eski `micPill`/`micDot` kaldırıldı; düğme etiketleri ("Mikrofonu sustur/aç") + aria-pressed eklendi.
- **Kullanıcı geri bildirimi (aynı tur):** düğme beğenildi ("güzel"); asıl rahatsızlık ortadaki görselde sesize alınınca çıkan **kırmızı çapraz çizgi**ydi (muted çizimi) — kaldırıldı; muted artık sakin, kesikli, soluk bir çizgi; "kapalı" bilgisi MIC düğmesi + durum metninde yaşıyor.
- **V1-16 kapandı ✅:** kullanıcı düğmeyi kabul etti ("tamam okey idare eder") — EKSIKLER §9/6 ✅ bölümüne taşındı, V1-UPDATE'te ✅ işaretlendi.
- **Hafıza & not denetimi (kullanıcı sorusu üzerine):** (1) uygulama hafızası 16.10 sabah sessizce boşaltılmış bulundu — kodda yedeksiz/log'suz tek silme yolu Ayarlar → Hafıza'daki ✕ / "Tümünü sil"; sesli testlerdeki "hatırlamıyor" davranışının sebebi bu. (2) Log'da `not_al` → "Hedef klasör mevcut değil." hatası tespit edildi (not yazılamamış). İkisi EKSIKLER §3/§4'e işlendi → **Tur 10'da çözüldü.**
- **Kanıt:** 168 test ✅ (themes +5, mic-eq +4, UI +2), `verify` yeşil, secret taraması temiz.

## Tur 10 — Otomatik çalışma (kullanıcı talimatı: "tüm notları ve eksikleri bitir; en son konuşuruz")

> Çalışma kuralı: soru sorulmaz; biriken sorular `SORULAR.md`'de tutulur. Her adım `verify` + commit ile kapanır.

- **Hafıza kurtarma:** 16.10'da sessizce boşaltılan hafıza geri yüklendi (6 kayıt: kişisel kayıtlar (ayrıntılar yalnızca cihazdaki hafızada) · "efendim").
- **Hafıza silme koruması:** silme öncesi otomatik `memory.json.bak` + silme olaylarının log'a düşmesi (MemoryStore.backup + IPC logları).
- **Not (`not_al`) klasör dayanıklılığı:** modelin uydurduğu var olmayan klasör yok sayılır → hatırlanan klasör → kullanıcı seçimi (seçim `notes-dir.txt`'te hatırlanır). "Hedef klasör mevcut değil." hatası bitti.
- **A paketi — mikrofon & ses girişi (V1-01…V1-05) ✅:** mikrofon testi paneli (canlı seviye + sabit süreli test kaydı + dinleme + aktif cihaz adı); cihaz seçimi (enumerateDevices, devicechange yenileme, kayıp cihazda varsayılana düşme); kademeli yazılım katmanı (ek kazanç + gürültü kapısı, kayıt zinciri MediaStreamDestination üzerinden); "uyu" sesli komutu (pendingSleep) + `sleepAfterSec` ayarı (varsayılan 5 sn).
- **B paketi — sesli deneyim çekirdeği (V1-06/07/09) ✅:** SSE streaming (AgentLoop `chatStream` + `takeSentences`) → tamamlanan cümleler TTS kuyruğuna akar (AudioService `speakQueue`, `stopSpeaking` kuyruğu da temizler); “sus” ailesi sesli durdurma (barge-in zincirli); sözlü izin akışı (ekran kutusuz: `agent:confirm` olayı, evet/hayır çözümleyici, 20 sn zaman aşımı, Türkçe araç etiketleri). V1-08 (yerel uyandırma) model gömülmesi gerektiğinden paketleme aşamasına bırakıldı → SORULAR #5.
- **Kanıt:** 190 test ✅ (commands +5, sentences +6, loop streaming +2), `verify` yeşil, secret taraması temiz.
- **C paketi — anlayış & dayanıklılık (V1-10/11/12) ✅:** kısa süreli bağlam (son 6 tur ≤4000 karakter; yalnız RAM'de); yerel hatırlatıcı (“10 dakika sonra … hatırlat / alarm kur”, 2 sn–24 saat; sesli onay + görev balonu + sesli haber); yedek sağlayıcı (geçici DeepSeek hatasında Groq'a otomatik geçiş; ikisi de düşerse SESLİ hata).
- **Kanıt:** 201 test ✅ (commands +4, context +4, fallback +2, loop bağlam +1), `verify` yeşil, secret taraması temiz.
- **D paketi — arka plan & başlangıç (V1-13/14) ✅:** tepsi modu (X = tepsiye in; menü: Göster / Mikrofon Aç-Kapat / Ayarlar / Çıkış; ilk inişte tek sefer bilgilendirme; `backgroundThrottling:false`); Ayarlar → Genel'e “Windows açılışında başlat” anahtarı (durum işletim sisteminden okunur; yalnız kurulu sürümde etkin, kaynak modda dürüst “desteklenmez” notu).
- **Kanıt:** 201 test ✅ (D: yeni saf mantık yok; main süreç + arayüz bağlantısı — ayar testi köprüsü güncellendi), `verify` yeşil, secret taraması temiz.
- **F paketi — güvenlik & güven (V1-17/18/19) ✅:** işlem günlüğü (audit.jsonl, redact'lı, son 800; Ayarlar → “İşlem Kaydı” listesi/temizleme); not yedeği (üzerine yazmadan önce `.bak`, tek tıkla geri al); token sayaçları (aylık + toplam; sağlayıcı usage bildirdiğinde). Artı: ölü kontroller gerçek yapıldı — konuşma bağlamı temizleme, günlük temizleme, konuşma kaydı (opt-in `transcripts.jsonl`) + “Kayıtları sil”.
- **Kanıt:** 204 test ✅ (loop kullanım/olay +2, client usage +1), `verify` yeşil, secret taraması temiz.
- **Ek paket — ayarları dışa/içe aktarma ✅:** Ayarlar → Genel'de “Ayarları dışa aktar / içe aktar” (JSON; kaydet/aç diyalogları). API anahtarları dosyaya DAHİL DEĞİL (ayrı ve şifreli vault'ta). İçe aktarmada dosya doğrulanır, ardından ayarlar zod ile temizlenip uygulanır. EKSIKLER §6–7'deki bayat maddeler kapatıldı (Şafak açık teması zaten var — kayıt güncellendi).
- **Kanıt:** 204 test ✅ (yeni saf mantık yok; main diyalog akışı + köprü tipleri), `verify` yeşil, secret taraması temiz.
- **Tur 10 düzeltme — mikrofon “ölü” hatası ✅ (16.10):** kullanıcı bildirimi: “Windows'ta ses temiz, uygulamada çoğu zaman hiç ses yok.” Kök sebep: gürültü kapısı seviyeyi kazançtan SONRA ölçüyordu (analyser `gainNode` çıkışına bağlıydı); kapı kapandığı an seviye ~0 okunuyor ve kapı bir daha açılamıyordu → tüm kayıtlar sonsuza dek “sessizlik” (log kanıtı: art arda `kayıt sonu: sessizlik`). Düzeltme: analyser ham kaynağa taşındı (VAD/gürültü kapısı/barge-in ham seviyeyle çalışır — kapı kilitlenemez); askıya düşen AudioContext açılışta ve seviye döngüsünde kendiliğinden resume ediliyor; kopan cihaz akışı (`readyState=ended`) atılıp otomatik yeniden açılıyor.
- **Kanıt:** 211 test ✅ (gateDecision +4, zincir bağlantısı regresyonu +3), `verify` yeşil, secret taraması temiz.
- **Mikrofon kalibrasyonu (ölçümle) ✅ (16.10):** `scripts/mic-tanilama.cjs` + `scripts/mic-analiz.mjs` eklendi — hoparlörden test cümlesi çalınırken seviye ölçer (uygulamayla birebir metrik: rms×3, ~144 Hz). 3 profil ölçüldü (app/raw/nsauto, 40 sn): konuşma tepesi **0.45 (AGC açık) ↔ 0.05 (AGC kapalı)** → oto kazanç bu makinede kritik; gürültü bastırma ortam sıçramalarını **0.135→0.101**'e indiriyor → açık kaldı; ortam tabanı ~0.017-0.019 (sakin). Uygulanan ayar: hassasiyet 6→**8** (minPeak 0.148→0.124 — ölçülen sıçramaların üstünde, konuşmayı daha kolay kabul), gürültü kapısı "düşük"→**kapalı** (taban zaten eşiğin altında). `settings.json` `.bak` yedeğiyle güncellendi (ayar dosyası repoda değil).
- **Kanıt:** 211 test ✅ (koda dokunulmadı — araç + kalibrasyon), `verify` yeşil, secret taraması temiz.
