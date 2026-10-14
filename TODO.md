# QUATRA — Premium AI Desktop Assistant (Modüler TODO)

> Asistan adı: **Quatra** (prompttaki eski isim geçersizdir)
> **Çalışma prensibi:**
> 1. Tüm yapı modüler olacak.
> 2. Tüm planlar bu dosyada tutulacak.
> 3. Her adımda `npm run verify` (typecheck + lint + test) geçmeden devam edilmeyecek.
> 4. **İzolasyon kuralı:** Bir modül patladığında uygulamanın tamamı bozulmayacak (aşağıdaki §0 ilkeleri her fazda uygulanır).

---

## §0 — Mimari İlkeler: İzolasyon & Optimizasyon (tüm fazlar için zorunlu)

**Neden:** Tek bir arıza (bozuk mic, Groq kesintisi, patlayan tool, çöken renderer) tüm asistanı devirmemeli.

1. **Süreç izolasyonu (Electron):**
   - `main` (Node yetkileri) ↔ `preload` (dar `quatra.*` köprüsü) ↔ `renderer` (React, secretsiz). Renderer'dan direkt Node/Groq-key erişimi YOK.
   - Renderer çökerse: pencere yeniden yüklenir, main + ayarlar + mic-release korunur. Main'de `uncaughtException` → logla + güvenli durumda tut, sessizce kapatma.
2. **Modül izolasyonu:**
   - Her feature (`assistant`, `settings`, `audio`, `agent`, `tools`, `providers/*`, `services/*`) **interface arkasında**, birbirinin içini bilmez. Bağımlılıklar constructor'dan enjekte edilir (globals yok).
   - Her tool çağrısı kendi `try/catch + timeout`'unda koşar; bir tool patlarsa loop ölmez, hata result olarak modele döner.
   - Supervisor yaklaşımı: `agent/loop` her iterasyonda iptal/timeout/limit kontrol eder; takılan istek `AbortController` ile öldürülür.
3. **Hata sınırları (UI):**
   - Her feature alanının üstünde React `ErrorBoundary` → bozuk settings paneli ana ekranı, bozuk visualizer mic'i devirmez. Sade fallback + Diagnostics linki.
   - Visualizer state machine'e geçersiz geçiş işletilemez (typed transition map + test).
4. **Dayanıklılık desenleri:**
   - Her ağ/donanım çağrısında **timeout + bounded retry + circuit-breaker** (üst üste 5 hata → 60sn soğuma, UI'da dürüst "servis molada" durumu).
   - Ayar yazımı **atomik** (geçici dosyaya yaz + rename); bozuk config'te son sağlam config + defaults'a düş.
   - Mic watchdog: error/shutdown/kesinti sonrası capture kesinlikle serbest bırakılır.
5. **Graceful degradation matrisi (beklenen davranışlar):**

   | Arıza | Beklenen davranış |
   |---|---|
   | Groq down / rate-limit / invalid key | `error` rozeti + setup prompt, ana ekran + settings yaşar, kuyruk yok |
   | İnternet yok | Dürüst "çevrimdışı" rozeti (sahte error değil), local tool'lar çalışmaya devam eder |
   | Mic yok / izin reddi / cihaz koptu | Visualizer `muted`, mic testi hata + recovery yolu, TTS + tool'lar yaşar |
   | STT servisi öldü | Dinleme durur + hata, metin yedeği SADECE settings test alanında (ana ekrana chat kutusu YOK) |
   | TTS öldü | Cevap ephemeral caption'da gösterilir, konuşma atlanır, akış ölmez |
   | Bir tool patladı | O tool `disabled` işaretlenir, diğer tool'lar + agent yaşar |
   | Wake-word motoru yok | Deneysel flag kapalı + setup açıklaması, PTT + manual her zaman yaşar |
   | Renderer crash | Pencere reload, main/settings korunur |
6. **Güvenlik sınırları:** Secret'lar sadece `services/credentials` (OS keychain/keytar; yoksa limit + güvenli fallback doc). Log/diagnostics sınırında otomatik redact. Model/web/dosya içeriği **untrusted** → talimat enjeksiyonu olarak yorumlanamaz, shell'e string gömülemez.
7. **Bağımlılık diyeti (az bağımlılık = az patlama noktası):**
   - Kilitli: `zustand` (store), `i18next` (**sadece tr+en**), `zod` (şema), CSS modules (Tailwind yok — build eklentisi riski alınmaz), `electron-log` (rotasyonlu log).
   - Opsiyonel (yoksa degrade): `keytar` (secure key), `electron-updater` (releases).
   - V1 ses: **Web Speech API (STT) + sistem `speechSynthesis` (TTS)** — sıfır ek bağımlılık, kurulum yok. V2: Groq Whisper + lokal Piper.
   - Test: `vitest` + Testing Library + jsdom (dev-only, izole).

---

## FAZ 1 — Inspect ✅ Tamamlandı (2026-10-14)

- Shell: **Electron 33 + Vite 6 + React 18 + TS 5.6 (strict)** — `electron/main.ts`, `electron/preload.ts` mevcut
- `npm run verify` ✅ (typecheck + eslint + 7 vitest), `npm run build` ✅ (`dist/` + `dist-electron/`)
- Mevcut: `src/core` (config, logger, event-bus), `src/modules/plugins` (PluginManager + testler), `src/renderer` (minimal App), `src/shared`
- Node 22.23.2 var. **Rust/cargo YOK** → Tauri native build alınamaz (prompt §2 istisnası geçerli)
- CI var, husky yok
- **Mimari karar (2026-10-14, kullanıcı onayı): Electron'da kal.** Native yetenekler `services/native` interface arkasında → ileride Tauri'ye taşınabilir.

---

## Hedef Klasör Yapısı

```
src/
  app/                    # MainScreen, ErrorBoundary, first-run orkestrasyonu
  components/             # Button, Switch, Slider, Select, Dialog, StatusDot, EphemeralCaption
  features/
    assistant/            # visualizer state machine + ana ekran (izole)
    settings/             # 8 kategori UI + validasyon (kendi ErrorBoundary'si)
    audio/                # capture, VAD, playback, analyser (watchdog'lu)
    agent/                # loop (supervisor: timeout/cancel/limit), context
    tools/                # registry (per-tool izolasyon), permissions, built-in tool'lar
  providers/
    types.ts              # ProviderAdapter interface
    groq/                 # client (timeout/retry/circuit-breaker içeride)
  services/
    native/               # Electron IPC (soyut, Tauri'ye taşınabilir)
    stt/ | tts/           # V1: Web Speech + speechSynthesis; V2: Whisper + Piper
    credentials/          # keychain/keytar veya limit-doc + fallback
    storage/              # atomik persistence
    log/                  # electron-log + redact + rotation
  state/                  # settingsStore (zustand), assistantStore, featureFlags
  types/                  # Tool, ModelRequest/Response, Permission, AgentEvent, VisualizerState, QuatraError
  utils/                  # redact, backoff, circuit-breaker, schema, offline-detect
electron/                 # main.ts (crash-guard), preload.ts (dar quatra.* köprüsü)
tests/
  unit/                   # credentials'sız vitest
  integration/            # gerçek Groq anahtarı (manuel, CI dışı)
  fault/                  # arıza enjeksiyon testleri (mic-öldü, ağ-yok, tool-patlattı)
docs/
.env.example              # SADECE non-secret
```

Tasarım: bg `#08090D`, accent `#9B87F5`, Inter (bundle), FR §3 kuralları.

---

## FAZ 2 — Visual Foundation

- [ ] 2.1 `types/visualizer.ts` — 6 state + typed transition map (geçersiz geçiş compile+test'te yakalanır)
- [ ] 2.2 `features/assistant/Visualizer.tsx` — idle çizgi / listening halka+**gerçek** mic analyser / processing orbital / speaking **gerçek** output analyser / muted sabit / error sade. RAF ile, memo'lu, `Math.random()` YASAK
- [ ] 2.3 `app/MainScreen.tsx` — Quatra label, visualizer, status, settings butonu, mic/mute, bağlantı durumu. Chat paneli YASAK. **Ephemeral caption:** son duyulan/söylenen tek satır, 5sn'de solar (transcript yerine)
- [ ] 2.4 `components/*` + `app/ErrorBoundary.tsx` (feature başına sınır: visualizer patlarsa ekran, settings patlarsa ana ekran yaşar)
- [ ] 2.5 CSS modules + design tokens, reduced-motion, focus-kaybında animasyon kısma, resize centering. **Performans bütçesi:** visualizer 60fps hedefi, gereksiz re-render yok (React.memo + store selector)
- [ ] 2.6 Lucide + bundled Inter. Testing Library + jsdom kurulumu
- **Test kapısı:** transition-map, ErrorBoundary fallback, ephemeral-caption davranışı, no-key/no-mic UI + `verify`

## FAZ 3 — Settings

Kategoriler: General, AI Provider, Voice & Audio, Activation, Agent Tools, Appearance, Privacy & Security, Diagnostics.
- [ ] 3.1 `services/storage` (atomik yazım + bozuk-config recovery) + `state/settingsStore` (zustand + zod) + `state/featureFlags` (wake-word deneysel, her tool enable/disable)
- [ ] 3.2 General — display name (default **Quatra**), personality, autostart/tray/minimized (desteklenmiyorsa "unavailable"), global shortcut, dil (**sadece tr+en**, i18next), version
- [ ] 3.3 Appearance — restrained accent palette, intensity, anim speed, glow, UI scale, reduced-motion, **canlı preview**
- [ ] 3.4 Privacy — mic status, wake-word toggle, clear logs, clear context, credential yönetimi, **tek tıkla secretsiz diagnostics export** (electron-log'dan, redact'lı)
- [ ] 3.5 First-run — minimal ekran → discreet Groq setup (gerçek test → model seçimi) → mic izni sadece voice'ta → mic+TTS testi
- [ ] 3.6 Ölü buton YASAK; her ayar çalışır veya "unavailable"
- **Test kapısı:** atomik persistence round-trip, bozuk-config recovery, invalid rejection, flag-kapalı tool gizliliği + `verify`

## FAZ 4 — Groq Provider (kendi içinde izole, UI'yı devirmez)

- [ ] 4.1 `providers/types.ts` + `providers/groq/client.ts` — güncel API, stream, **timeout + AbortController + bounded backoff + circuit-breaker (5 hata→60sn soğuma)**
- [ ] 4.2 Model uyumluluğu — default `openai/gpt-oss-120b`, liste gerçekten çekilir, ID varsayılmaz; çalışmayan modelde uyumlu alternatife düşüş önerisi
- [ ] 4.3 Tool-call parse — multi-tool, malformed-args, unsupported-capability graceful
- [ ] 4.4 Settings bağlantısı — provider select, key + visibility toggle, custom model, temperature, max tokens, timeout, **gerçek** test + status + last-error + retry config
- [ ] 4.5 Güvenlik — key sadece `services/credentials`, renderer'da secret YOK, log sınırında redact. **Offline rozeti:** ağ yoksa sahte error değil "çevrimdışı", local tool'lar çalışır
- **Test kapısı:** mock-network (auth/rate-limit/network/timeout), breaker-soğuma, redact, fallback + `verify`. Gerçek anahtar `integration/`da.

## FAZ 5 — Agent + Tools + Permissions [ÖNCELİKLİ]

- [ ] 5.1 `types/` — Tool/ToolSchema/ModelRequest/Response/`safe|low-risk|sensitive`/AgentEvent/`QuatraError`. `any` yasak
- [ ] 5.2 `features/tools/registry.ts` — PluginManager'ı genişlet: validate → permission → **per-tool timeout+try/catch** → result-schema. Patlayan tool loop'u öldürmez, `disabled` işaretlenir
- [ ] 5.3 `features/agent/loop.ts` — supervisor loop: validate → izin → çalıştır → modele dön → final veya max-iteration. Her adımda cancel/timeout/limit; takılan istek öldürülür
- [ ] 5.4 `features/tools/permissions.ts` — central manager, **native-layer enforcement**, allowlist, model-bypass + prompt-enjeksiyon koruması
- [ ] 5.5 Built-in V1 (hepsi GERÇEK): sysinfo, app-version, date-time | open-app (allowlist), open-url, open-file/dir | file-search (seçili dizin) | volume get/set/mute (desteklenirse) | clipboard (izinli) read/write | **not-al** (seçili klasöre markdown) + **hatırlatıcı-kur** (OS notification)
- [ ] 5.6 Session context + clear-context; long-term memory yok (opsiyonelse transparent)
- [ ] 5.7 Tool execution logları (redact'lı, Diagnostics'te observable)
- **Test kapısı:** validation, unknown-tool, permission-enforce, iteration-limit, per-tool-timeout (yavaş tool loop'u kilitlemez), cancel, redact + `verify`

## FAZ 6 — Audio/STT/TTS (watchdog'lu, degrade olabilir)

- [ ] 6.1 `features/audio/*` — capture/VAD/playback/analyser ayrımı; `services/stt` + `services/tts` interface
- [ ] 6.2 **V1 kilitli:** Web Speech API (STT) + `speechSynthesis` (TTS), dokümante, sıfır bağımlılık. Cloud'a giden veri varsa açıkça yazılır. V2: Groq Whisper + Piper (ayrı faz)
- [ ] 6.3 Voice & Audio settings — **gerçek** cihaz/ses listeleri, input meter, mic test, output volume, rate, test-voice, auto-play, interrupt, stop-speaking, device-error + recovery
- [ ] 6.4 Activation — PTT (configurable) + manual (her zaman) + wake-word **deneysel flag arkası** (motor yoksa setup açıklaması, sahte "çalışıyor" YOK)
- [ ] 6.5 Interruption — stop → cancel → listening; üst üste konuşma yok. **Mic watchdog:** her error/shutdown yolunda capture serbest
- [ ] 6.6 STT ölürse settings-test-alanı yedeği (ana ekrana kutu YOK); TTS ölürse ephemeral caption'a düş
- **Test kapısı:** `tests/fault/` (mic-öldü, cihaz-koptu, STT-fail, TTS-fail), interruption sırası + `verify`

## FAZ 7 — Native Derinleştirme (main-process guard'lı)

- [ ] 7.1 `services/native/*` + `electron/*` — sysinfo, autostart, tray, window, volume-native, file-dialog, shell-guard. `uncaughtException` → logla + güvenli durumda tut
- [ ] 7.2 Güvenlik sertleştirme — `sandbox` + CSP + `setPermissionRequestHandler` + navigation guard (dış URL sadece OS browser'da)
- [ ] 7.3 Secure credentials final — keytar/keychain veya limit-doc + fallback. Renderer crash → pencere reload, main/settings korunur
- [ ] 7.4 Windows + macOS farkları README'de
- **Test kapısı:** native mock'lu testler + reload-recovery + `verify`

## FAZ 8 — Test & Polish

- [ ] 8.1 Eksik testler: settings-invalid, provider-errors, breaker, permission-deny, agent-limits, cancel, redact, no-key/invalid-key/network-fail/mic-denied/tool-success
- [ ] 8.2 **Arıza enjeksiyon turu:** her matris satırı (bkz §0.5) elle + `tests/fault/` ile doğrulanır; tek arızada tüm-app-çökmesi aranır
- [ ] 8.3 UX — hızlı listening feedback, net processing/speaking, shortcuts, Esc-cancel, mute, retry, destructive onayları
- [ ] 8.4 Error taksonomisi + Diagnostics (provider/model/mic/output/tools/permissions/sanitized errors — sahte health-score YOK)
- [ ] 8.5 Ölü-buton taraması + `format + verify + build` yeşil + **smoke test:** build sonrası Electron headless açılıp ana ekran screenshot
- **Test kapısı:** FULL `verify` + `build` + smoke + fault-matrisi tikli

## FAZ 9 — Docs & Release

- [ ] 9.1 README — mimari, prerequisites, dev/build, Win/mac setup, Groq config, model seçimi, V1 ses (Web Speech) limitleri, wake-word deneysel notu, tool izinleri, güvenlik, troubleshooting, testler, known-limitations
- [ ] 9.2 `.env.example` (non-secret), diagnostics-export doc, offline-davranış doc
- [ ] 9.3 Release akışı — electron-builder + (opsiyonel) electron-updater/GitHub Releases + changelog
- [ ] 9.4 Final rapor — implemented/tested, komutlar, sonuçlar, kurulum, limitler. Olmayan "oldu" denmez
- **Test kapısı:** README'deki her komut koşar

---

## Definition of Done (İlk Release)

- [ ] Uygulama açılır (Win + mac doc'lu)
- [ ] Ana ekran minimal, chat/prompt kutusu YOK (ephemeral caption hariç)
- [ ] Visualizer gerçek state + gerçek audio
- [ ] Settings persist + bozuk-config recovery
- [ ] Groq test GERÇEK request; breaker + offline rozeti çalışır
- [ ] Seçili model cevap döner
- [ ] Agent ≥1 GERÇEK tool'u tool-calling ile çalıştırır; patlayan tool diğerlerini devirmez
- [ ] Permission enforcement native-layer'da
- [ ] Mic + TTS + interrupt + mic-watchdog
- [ ] Key sızıntısı yok (log/dosya/bundle taraması)
- [ ] **Fault matrisi (§0.5) tüm satırlar yeşil:** hiçbir tek arıza tüm app'i devirmez
- [ ] Unit (credentials'sız) + fault + smoke yeşil; typecheck + lint + build yeşil
- [ ] README gerçekliği anlatır; ölü/sahte UI yok

## Aktif Adım Takibi
- **Tamamlanan:** FAZ 0 iskelet ✅, FAZ 1 inspect ✅, plan-review ✅ (2026-10-14)
- **Karar:** Electron'da kal (onaylı). V1 ses: Web Speech + speechSynthesis (kilitli). Stil: CSS modules. Store: zustand. i18n: tr+en.
- **Şu an:** FAZ 2.1'e hazır — `types/visualizer.ts` + transition testleri
- **Durum:** Onay bekleniyor (FAZ 2 mi, öncelikli FAZ 5 mi?)
