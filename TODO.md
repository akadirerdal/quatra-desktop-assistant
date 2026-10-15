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

### Phase 0 — Audit and Foundation
- [x] **0.1 Repo denetimi** — ✅ 2026-10-15 (bkz §0 tablo). Bağımlılık listesi: runtime sadece React; dev: electron/vite/vitest/eslint/prettier. Eksik: zod, zustand, i18next, electron-log, Testing Library, jsdom.
- [ ] **[P0] 0.2 Secret hijyeni + config iskeleti**
  - Description: `.gitignore`'a `.env*` (`.env.example` hariç), `src/utils/redact.ts` (key/token maskesi), `.env.example` (yalnız non-secret: `QUATRA_LOG_LEVEL`, `QUATRA_TELEMETRY=off`). İlk günden `gitleaks` uyumlu ignore seti.
  - Reason: Repo'da `.env` koruması yok; ilk key girildiğinde sızma riski doğar.
  - Dependencies: yok. Acceptance: `git status` .env'i asla göstermez; redact unit testleri var.
  - Verification: `npm test` + elle `git check-ignore -v .env` → eşleşmeli. Platform: Both.
- [ ] **[P0] 0.3 Sağlayıcı abstraction iskeleti**
  - Description: `providers/types.ts` (`ProviderAdapter`: chat/stream/listModels/testConnection/toolCall formatı) + `providers/deepseek/client.ts` iskelesi (henüz UI yok).
  - Reason: DeepSeek birincil; Groq ikincil. UI'ya sonradan gömülürse geri dönüşü pahalı.
  - Dependencies: 0.2. Acceptance: interface derleniyor; mock adapter testi geçiyor.
  - Verification: `npm run verify`. Platform: Both.
- [ ] **[P1] 0.4 Loglama + hata taksonomisi**
  - Description: `electron-log` (rotasyonlu) + `types/errors.ts` (auth/rate-limit/network/timeout/tool/mic/stt/tts sınıfları) + Diagnostics ekranının okuyacağı sanitized ring-buffer.
  - Reason: Hata yönetimi ve redaction, güvenli hata gösteriminin ön şartı.
  - Dependencies: 0.2. Acceptance: her sınıf için mapping testi; logda key asla yok (testli).
  - Verification: `npm test` + mock key ile log çıktı taraması. Platform: Both.
- [ ] **[P1] 0.5 Test altyapısı genişletme**
  - Description: Testing Library + jsdom; `tests/fault/` klasörü; coverage raporu (`vitest --coverage`).
  - Reason: FAZ 1+ her adımın test kapısı var; altyapı şart.
  - Dependencies: 0.2. Acceptance: örnek component testi + örnek fault testi yeşil.
  - Verification: `npm run verify`. Platform: Both.
- [ ] **[P1] 0.6 Cross-platform değerlendirme**
  - Description: Win/mac davranış matrisini `docs/platform-matrix.md`'ye yaz: autostart, tray, global shortcut, ses cihazları, izinler, dosya yolları. Bu makinede yalnız Windows doğrulanabilir → macOS "unverified" etiketli.
  - Reason: "Ikisinde çalışır" iddiası ancak matris + gerçek test ile dürüst olur.
  - Acceptance: matris doc'ta; bilinmeyenler açıkça "unverified". Verification: doküman gözden geçirme. Platform: Both (test: Win).

**Phase 0 kapısı:** `npm run verify` yeşil + redact testi kanıtlı.

---

### Phase 1 — Reliable Core Assistant (MVP'nin kalbi)
- [ ] **[P0] 1.1 DeepSeek adapter (gerçek entegrasyon)**
  - Node tarafında (main process) HTTP: streaming (SSE), timeout + `AbortController`, rate-limit + bounded backoff, 401/402/429 ayrıştırma. Key sadece `services/credentials`'dan okunur.
  - Reason: Ürünün birincil motoru; MVP'nin ön şartı. Dependencies: 0.2, 0.3.
  - Acceptance: mock-network testleri (auth/rate-limit/network/timeout) geçer; gerçek anahtarla manuel çağrı cevap döner; key logda/renderer'da asla görünmez.
  - Verification: `tests/unit/providers/*` + manuel `integration` koşumu. Platform: Both.
- [ ] **[P0] 1.2 Gerçek bağlantı testi + model seçimi**
  - Description: Settings'te "Test" butonu gerçek `listModels`/chat isteği atar; model listesi gerçekten çekilir (`deepseek-chat`, `deepseek-reasoner` doğrulanır); başarısızlıkta dürüst hata + last-error gösterilir.
  - Reason: Sahte "bağlı" durumu yasak; kullanıcı gerçek durumu görmeli. Dependencies: 1.1.
  - Acceptance: geçersiz key → failed + mesaj; geçerli key → model listesi görünür. Verification: manuel senaryo + unit. Platform: Both.
- [ ] **[P0] 1.3 Konuşma durumu + streaming UI**
  - Description: `state/assistantStore` (zustand): messages, status (idle/processing/error), cancel. Streaming token'lar ephemeral caption + (opsiyonel) Diagnostics transcript'ine akar; ana ekranda chat paneli YOK.
  - Reason: Tek doğru kaynak durum yönetimi; UI'nin çökmeden akması. Dependencies: 1.1.
  - Acceptance: Cancel butonu stream'i gerçekten durdurur (AbortController testli); store selector optimizasyonu (gereksiz render yok).
  - Verification: unit + rerender sayım testi. Platform: Both.
- [ ] **[P0] 1.4 Ses pipeline (V1 kilitli: Web Speech STT + speechSynthesis TTS)**
  - Description: `features/audio/*` capture/VAD/playback ayrımı; STT/TTS interface'leri; mic izni sadece ses aktive edilince; interrupt: stop → cancel → listening; mic watchdog.
  - Reason: Voice-first ürünün çekirdeği; MVP şartı.
  - Dependencies: 1.3. Acceptance: gerçek mikrofondan cümle metne döner; TTS duyulur ve kesilebilir; tüm error yollarında mic bırakılır (fault testi).
  - Verification: `tests/fault/` (mic-öldü, izin-reddi, cihaz-koptu) + canlı test. Platform: Both (Win kanıtlı; mac unverified).
- [ ] **[P0] 1.5 Visualizer state machine + minimal ana ekran**
  - Description: 6 state (idle/listening/processing/speaking/muted/error) typed transition map; idle çizgi / listening halka + GERÇEK mic analyser / processing orbital / speaking GERÇEK output analyser / muted / error. Ephemeral caption (5sn solar). `Math.random()` YASAK.
  - Reason: "Premium his" bu ekranda; sahte reaktivite yasak. Dependencies: 1.4 (analyser verisi).
  - Acceptance: state geçiş testleri; mikrofon yoksa dürüst non-reaktif animasyon; reduced-motion saygılı.
  - Verification: transition unit testleri + elle görsel tur (resize, focus-loss). Platform: Both.
- [ ] **[P1] 1.5b Görev baloncuğu (kullanıcı tasarım kararı)**
  - Description: Verilen görev uygulama içinde sağ/sol alt köşede **saydam** kutuda görünür: "alarm kuruluyor…" → bitince "alarm kuruldu — 06:00" → birkaç saniyede yavaşça kaybolur; önceki görevler soluklaşır. Geçmiş sadece Diagnostics'te. Belirgin olmayacak, rahatsız etmeyecek ama görünür kalacak.
  - Reason: Kullanıcı görevlerin takibini istiyor; ekran minimal kalmalı. Dependencies: 1.5, 1.3.
  - Acceptance: balon çalışırken/bitince doğru metin; otomatik kaybolma; ekranı doldurmaz. Verification: component testi + görsel tur. Platform: Both.
- [ ] **[P1] 1.5c Model göstergesi + mod sistemi V1 (kullanıcı tasarım kararı)**
  - Description: Ekran alt-ortasında soluk pill: aktif model (örn. "DEEPSEEK v4 FLASH · Hızlı"). Sohbet modu = Flash (hızlı yanıt); Yazılım/Proje modu = Pro/Max (derin). Sesli komutlar: "yazılım moduna geç", "normal moda geç", "mod değiştir". Değişim anında pill'de görünür. Gerçek model adları (flash/pro/max/default) kurulumda sağlayıcıdan çekilip doğrulanır; listede olmayan model "çalışıyor" gösterilmez.
  - Reason: Kullanıcı hangi beynin konuştuğunu bilmek istiyor; tek tuş/komutla mod geçişi. Dependencies: 1.1, 1.2.
  - Acceptance: komutla mod değişir + pill güncellenir; geçersiz model gösterilmez. Verification: unit (mode reducer) + canlı test. Platform: Both.
- [ ] **[P1] 1.5d Sade simge kuralı**
  - Description: Göze çarpan absürt ikonlar YOK; dişli/mikrofon küçük ve soluk; "göster" gibi metin alternatifleri tercih edilir. Mockup kılavuzu: PDF "Arayüz Planı" bölümü.
  - Reason: Kullanıcı geri bildirimi — süsleme az olmalı. Acceptance: görsel turda hiçbir ikon dikkat çekmez. Platform: Both.
- [ ] **[P0] 1.6 Tool-calling çekirdeği + ilk 3 tool**
  - Description: `features/tools/registry.ts` (validate → permission → per-tool timeout+try/catch → result-schema), `features/agent/loop.ts` (supervisor: max-iteration, iptal, timeout), `permissions.ts` (safe/low-risk/sensitive + native-layer enforcement). İlk tool'lar: **sysinfo** (gerçek OS bilgisi), **open-app** (allowlist), **not-al** (seçili klasöre markdown yaz).
  - Reason: "Ajan" iddiasının ölçülebilir kanıtı; patlayan tool diğerlerini devirmemeli. Dependencies: 1.1.
  - Acceptance: en az 1 gerçek tool tool-calling ile uçtan uca çalışır; bilinmeyen/bozuk arg reddedilir; izinsiz sensitive tool çalışmaz; loop limiti testli; yavaş tool loop'u kilitlemez.
  - Verification: `tests/unit/tools/*` + `tests/fault/tool-patlat.test.ts`. Platform: Both.
- [ ] **[P1] 1.7 Settings V1 (General + AI Provider + Voice + Privacy)**
  - Description: zod-validated store; atomik persistence; bozuk-config recovery; restore-defaults (onaylı); key girişi + visibility toggle; first-run akışı (key yoksa discreet setup, sahte "bağlı" YOK).
  - Reason: Kalıcılık ve güvenli key akışı olmadan ürün kullanılamaz. Dependencies: 1.1, 0.4.
  - Acceptance: restart sonrası ayarlar kalır; bozuk config defaults+açıklama ile açılır; key asla localStorage/düz dosyada değil.
  - Verification: persistence round-trip + corrupt-config testi. Platform: Both.

**Phase 1 kapısı:** MVP tanımı (§1) eksiksiz kanıtlanır; `verify + build + fault matrisi` yeşil.

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
- [ ] **[P0] 4.3 Secret yönetimi final** — keytar/keychain + fallback doc; log/diagnostic redact testleri; `git grep` secret taraması CI'a.
- [ ] **[P1] 4.4 Audit log + yıkıcı işlem onayları + file backup/undo** — her sensitive işlem kaydı (redact'lı); silme/taşımada otomatik yedek (`.quatra-backup/`) + undo.
- [ ] **[P2] 4.5 Sandboxed kod koşturma** — yalnız izole süreç/klasör, süre limiti, ağ kapalı; "run_code" tool'u bu kuralların dışına çıkamaz. (V1'de YOK; iskelet plan.)
- [ ] **[P0] 4.6 Yetkisiz davranış testleri** — `tests/fault/`: izinsiz sensitive deneme, bozuk arg, modelin kendi iznini genişletme denemesi → hepsi reddedilmeli.

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
1. **[P0] 0.2 Secret hijyeni + redact** — en ucuz, en kritik güvenlik adımı.
2. **[P0] 1.1 DeepSeek adapter (main-process, mock-testli)** — ürünün motoru; gerçek bağlantı olmadan hiçbir senaryo test edilemez.
3. **[P0] 0.3 + 1.6 iskeleti paralel başlat** — provider interface + tool registry çekirdeği; üstüne tüm fazlar oturur.

## 7. Aktif Adım Takibi
- **Tamamlanan:** Phase 0.1 audit ✅ (2026-10-15). Önceki iskelet (Electron+Vite+React+TS, 7 test, build) ✅.
- **Karar:** MVP = Phase 0+1; sıra: 0.2 → 1.1 → (paralel 0.3/1.6) → 1.2-1.7.
- **Şu an:** Roadmap onayı bekleniyor; kod yazımı başlatılmadı (bu görev sadece planlama).
