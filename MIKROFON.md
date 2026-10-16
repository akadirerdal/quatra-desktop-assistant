# Quatra — Mikrofon & Ses İşleme Sistemi · "Ses Stüdyosu" Planı

> **Kaynak:** Kullanıcının 16.10.2026 tarihli *"Professional Microphone & Audio Processing System"* prompt'u (OBS Studio esinli iş akışı; görsel dil Quatra'nın kendi premium-karanlık tasarımı — OBS markası/görselleri kopyalanmaz).
> **Durum:** 📝 Planlama — bu turda **kod yazılmadı**. Uygulama aşamalı (S1–S8); her aşama `npm run verify` + commit ile kapanır.
> **İlişkili:** `EKSIKLER.md` #5 (mikrofon kilidi kaldırma → S1'de uygulanır) · `V1-UPDATE.md` A paketi (V1-01..05 öncülü) · `SORULAR.md` #11–13 · Kod: `src/features/audio/*`, `src/features/settings/SettingsPanel.tsx`, `src/state/settings-schema.ts`

## 1. Hedef

Quatra'ya gerçek zamanlı çalışan profesyonel bir mikrofon zinciri ve **"Ses Stüdyosu"** ekranı: cihaz yönetimi, canlı mixer, gerçek DSP filtreleri, presetler, teşhis.

Değişmez ilkeler:
- **Gerçek işlem:** her kontrol gerçek ses örneklerini değiştirir; sahte/gösterimlik kontrol yok (proje kuralı).
- **Ham ↔ işlenmiş ayrımı:** iki ayrı ölçüm noktası; UI ikisini ayrı gösterir.
- **Asistan hattı öncelik:** uyandırma, barge-in, STT ve TTS davranışları bozulmaz; TTS çıkışı bu zincirden etkilenmez.
- **Güvenli varsayılan:** monitor kapalı; geri besleme koruması; parametre değişiminde tık/pop yok.
- **Dürüstlük:** platform/API desteklemiyorsa o ayar gösterilmez ya da açıkça "desteklenmiyor" etiketi alır.
- **Windows + macOS** hedefi; platforma özel farklar dokümante edilir.

## 2. Mevcut durum (kod haritası — 16.10.2026)

| Parça | Yer | Ne yapıyor |
|---|---|---|
| Capture | `src/features/audio/audio-service.ts` | `getUserMedia` (gürültü/yankı/AGC kısıtları + cihaz seçimi `exact`; cihaz yoksa varsayılana düşme); AudioContext; ölü akış tespiti + kendiliğinden yeniden açma |
| Zincir (bugün) | aynı dosya | `source → analyser` (**HAM tap**) + `source → gainNode` (ek kazanç + gürültü kapısı, 40ms rampalı) `→ MediaStreamDestination` |
| Seviye/kapı matematiği | `src/features/audio/mic-levels.ts` | `gainValueOf`, `gateThresholdOf`, `gateDecision` (tek kare, **yalnız ham seviye**, 400ms hold) — saf ve testli |
| Kayıt → STT | `audio-service.ts` | MediaRecorder **işlenmiş akıştan** kaydeder → `window.quatra.stt.transcribe` → MAIN → Groq Whisper (ses diske yazılmaz; yalnız bellekte tutulup gönderilir) |
| Uyandırma | `src/features/audio/wake-word.ts` | Sürekli burst kaydı (eşik 0.06 sabit) + fuzzy "Quatra" eşleşmesi; `pause/resume`; "quatra + komut" tek nefeste |
| VAD/hayalet koruması | `audio-service.ts` + `assistant-controller.ts` | `vadThresholdOf` (hassasiyet 1..10), `minPeakOf`, uyarlanabilir ortam tabanı; boş/ filtrelenmiş STT = "duyulmadı" |
| Barge-in | `audio-service.ts` (aynı seviye döngüsü) | RMS birikimi (250ms) + konuşma başlayınca TTS'i kesme |
| TTS | `audio-service.ts` (ayrı AudioContext) | Edge neural (IPC) / sistem TTS; çıkış analyser'ı gerçek seviye verir |
| Ayarlar | `src/state/settings-schema.ts` (`voice.*`) | `micNoiseSuppression/EchoCancellation/AutoGain`, `vadSensitivity`, `micGainLevel`, `micGateLevel`, `inputDeviceId`, `sleepAfterSec`, `continuous`, `bargeIn`, `sttEngine`, `ttsEngine` |
| UI | `src/features/settings/SettingsPanel.tsx` | Ayarlar (9 kategori) → **Ses ve Giriş**: canlı seviye, cihaz listesi, 3 sn test + dinleme, kademeli katman seçicileri, hassasiyet, uyku süresi |
| Testler | `tests/unit/audio/*` | `mic-constraints`, `audio-graph`, `mic-levels`, `wake-word` |

Seviye metriği: `rms(ham) × 3` (0..1). Yeni katmanda UI'ya dBFS gösterimi eklenecek (`20·log10`, taban −60 dB); motor aynı ham metrikle beslenmeye devam eder.

Bilinen dersler (bu planı şekillendiriyor):
- Kapı kararı kazançtan SONRA ölçülünce kilitleniyordu → **karar kaynağı her zaman ham seviye** (düzeltme `3e6ac42`).
- Whisper sessizlikte hayalet cümle uyduruyordu → kalıp filtresi (`646a8ac`) + `minPeak` koruması.
- Kullanıcı kararı: eski "ek kazanç + gürültü kapısı" katmanı **koddan kaldırılacak** (`EKSIKLER.md` #5) — yerini bu planın gerçek zinciri alır.

## 3. Prompt'un istediği modüller → bizim karşılıklar

| Prompt modülü | Quatra'da karşılığı |
|---|---|
| AudioDeviceManager | `audio-service` cihaz bölümünün ayrıştırılmış hâli (`device-manager`): listeleme, seçim, kalıcılık, hotplug, izin/durum bilgisi |
| AudioCaptureService | `audio-service.ts` (mevcut capture + watchdog korunur) |
| AudioProcessingPipeline | **YENİ** `src/features/audio/dsp/` (saf çekirdek) + `pipeline-worklet.ts` (AudioWorklet sarmalayıcı) |
| AudioFilter (arayüz + uygulamalar) | **YENİ** aynı çatı altında: her filtre saf `process(frame)` + parametre doğrulama + smoothing |
| AudioLevelMeter | `mic-levels` genişler: ham + işlenmiş, peak/hold, dBFS ölçek |
| AudioPresetManager | **YENİ**; örnekler `settings.json` içinde yeni `audio` bölümünde (cihazdan bağımsız parametreler) |
| AudioRoutingService | `audio-service` içindeki ham/işlenmiş yönlendirme (wake/VAD = ham; kayıt/STT = işlenmiş) — mevcut yapı korunur, netleştirilir |
| AudioDiagnostics | **YENİ** "Teşhis" alt bölümü + mevcut `diagnostics` kategorisine özet |
| UI | Ayarlar → yeni **"Ses Stüdyosu"** kategorisi (yer kararı: `SORULAR.md` #11) |

Kural: mevcut servisler çoğaltılmaz; isimler mevcut mimariye uyarlanır; ilgisiz bölümler yeniden yazılmaz.

## 4. Filtreler — fizibilite ve plan

| # | Filtre | Yöntem | Not |
|---|---|---|---|
| 1 | Gürültü bastırma | (a) Chromium dahili kısıt (bugün çalışıyor) — **varsayılan**; (b) RNNoise (WASM, AudioWorklet, BSD-3 lisans) — **opsiyonel motor** | RNNoise 48kHz/mono 10ms çerçeve ister → yalnız o modülde dönüştürme; lisans/boyut notları dokümana |
| 2 | Gürültü kapısı | Saf DSP | open/close eşiği, attack/hold/release, hysteresis (hızlı aç-kapa yok); **karar kaynağı: ham seviye** (kilit dersi); UI'da açık/kapalı göstergesi |
| 3 | Expander | Saf DSP | threshold/ratio/attack/release/çıkış kazancı; sessizi aniden kesmek yerine kademeli kısar |
| 4 | Kompresör | Saf DSP (kendi çekirdeği) | threshold/ratio/attack/release/knee/makeup + **GR ölçeri** (GR'nin ölçülebilmesi için `DynamicsCompressorNode` yerine çekirdek tercih) |
| 5 | Limiter | Saf DSP (lookahead) | ceiling + attack/release; zincirin son durağı |
| 6 | EQ | Biquad (saf çekirdek) | Parametrik bantlar (frekans/gain/Q) + low-cut/HPF; hazır ayarlar: Doğal Ses / Derin Ses / Parlak Ses / Konuşma Netliği; frekans yanıtı grafiği katsayıdan hesaplanır (testli) |
| 7 | AGC | Saf DSP | Hedef seviye + maksimum kazanç; ortam gürültüsünü yükseltmez; tamamen kapatılabilir |
| 8 | De-esser | Saf DSP (bant bazlı) | Testleri geçmezse **çıkarılır** (prompt izin veriyor) — sahte kontrol yapılmaz |
| 9 | HPF/LPF | Biquad | EQ ile aynı çatı; kolay |
| — | Reverb/oda eko giderme | — | Güvenilir gerçek-zamanlı çözüm yok → **kapsam dışı**, dokümante edilir |

**Varsayılan zincir sırası (güvenli):** ham doğrulama/kanal → [seçili filtreler: bastırma → HPF → kapı/expander → kompresör → de-esser → EQ] → limiter → ölçüm → çıkış. Sıralama sürükle-bırak ile değiştirilebilir; **ilk (doğrulama) ve son (limiter) konumlar kilitli**.

## 5. Kritik teknik kararlar

- **DSP çekirdeği saf TypeScript** (`dsp/`): her filtre `process(Float32Array, params)`; tarayıcı API'si kullanmaz → vitest'te **gerçek test sinyalleriyle** (sessizlik / düşük-yüksek konuşma / gürültü / clipping) doğrulanır. Gerçek zamanlı çalıştırma AudioWorklet içinde (UI thread'de ağır iş yok).
- **Tek geçiş:** aynı örnekler zincirden bir kez geçer; çift işleme regresyon testi vardır.
- **İki ölçüm noktası:** `ham` (cihaz çıkışı — VAD, barge-in ve kapı kararı buradan) ve `işlenmiş` (zincir sonrası). Mixer ikisini ayrı gösterir.
- **Parametre güncelleme:** worklet'e mesaj + ~20ms rampa (tık/pop yok); geçersiz değerler limitli doğrulamayla reddedilir. JS tek iş parçacıklı — yarış koşulu yok.
- **Fallback:** AudioWorklet yüklenemezse basit GainNode yoluna düşülür; kayıt/uyandırma kesilmez (dürüst log).
- **STT hattı:** MediaRecorder işlenmiş akıştan kaydeder (bugünkü yol korunur) → Groq Whisper. Sağlayıcı değişmez.
- **Cümle başı/sonu kesilmesin:** kayıt zaten konuşmadan önce başlıyor; filtre rampaları + kapı hold ayarları buna göre test edilir. "Konuşma bitişi" zamanlaması (sessizlik süresi, başlangıç beklemesi) ileri ayarlara taşınır (şu an kodda sabit).
- **Uyandırma güvenliği:** "Quatra" kısa/tek kelime; kapı ve expander kelime başını/hece aralarını kesmemeli → filtreler açıkken uyandırma başarımı log'lu A/B ölçülür.
- **TTS etkilenmez:** zincir yalnız giriş tarafında; TTS kendi çıkış AudioContext'inde çalar (mevcut tasarım korunur).
- **Monitor (kendi sesini dinle):** varsayılan **KAPALI**; yalnız açık istekle; "hoparlörde geri besleme riski — kulaklık önerilir" uyarısı; kapatınca anında susar; asla kendiliğinden açılmaz.
- **Cihaz hotplug:** `devicechange` + track `ended` → akışı yeniden kur (mevcut iskelet genişletilir); seçili cihaz kaybolursa dürüst log + varsayılana düşme.
- **Örnekleme:** cihazın gerçek rate'i okunur ve gösterilir; gereksiz resampling yok. Buffer boyutu ve cihaz-başına kanal/rate listeleri Chromium API'sinde yok → gösterilmez.
- **Kapatma:** Çıkış'ta tüm track'ler + AudioContext'ler kapatılır (mevcut watchdog + yeni worklet).

## 6. Prompt'tan bilinçli sapmalar (dürüst liste)

1. **Cihaz başına "input channels / supported sample rates" listesi:** Chromium API vermiyor → cihaz adı + varsayılan işareti + gerçekleşen örnekleme oranı gösterilir.
2. **Buffer size seçimi:** API yok → gösterilmez. (Yalnız `latencyHint` denemesi "deneysel" etiketiyle değerlendirilebilir.)
3. **Reverb/oda eko giderme:** güvenilir gerçek-zamanlı çözüm yok → yok.
4. **De-esser:** ancak çalışan uygulama testlerden geçerse var.
5. **RNNoise ilk teslimde yok** — S6'da opsiyonel motor olarak eklenir (onay: `SORULAR.md` #13).
6. **Mixer'daki "ek ses kaynakları":** Quatra'da şimdilik yalnız mikrofon var → sahte kaynak eklenmez. (İleride gerçek bir ikinci kaynak olabilir: TTS çıkış fader'ı.)

## 7. Aşamalar (her aşama: `npm run verify` + commit + kullanıcıya deneme duyurusu)

- **S1 — İskelet + eski katmanın sökülmesi:** saf DSP çekirdek (`dsp/`: filtre arayüzü, smoothing, doğrulama), AudioWorklet köprüsü, ham/işlenmiş iki ölçüm noktası; eski "ek kazanç + gürültü kapısı" koddan çıkar (`EKSIKLER.md` #5); `micGainLevel`/`micGateLevel` ayarları emekliye ayrılır (şemadan çıkar; ayarlar zaten varsayılan). Test: çekirdek matematiği + zincir iskeleti.
- **S2 — Cihaz yönetimi:** liste/seçim/kalıcılık, hotplug, izin ve "cihaz yok" durumları; dürüst hata halleri. Test: cihaz durum makinesi.
- **S3 — Mixer + gerçek meter'lar:** ham ve işlenmiş seviye, peak/hold, dBFS ölçek, clip göstergesi; UI'a "Ses Stüdyosu" (Cihazlar + Mixer sekmeleri) girişi.
- **S4 — Çekirdek filtreler 1:** HPF, kapı (hysteresis), expander, kompresör (GR'li), limiter — her biri parametre paneli + saf testler (sessizlik / düşük / yüksek / clipping).
- **S5 — STT & wake uyumu:** işlenmiş akış STT'ye (mevcut yol), uyandırma A/B ölçümü, VAD zamanlamalarının (sessizlik bitişi, başlangıç beklemesi) ayarlara taşınması, gecikme ölçümü.
- **S6 — Filtreler 2:** EQ (+frekans grafiği), de-esser, AGC; onaylıysa RNNoise motoru.
- **S7 — Presetler + ileri ayarlar + teşhis:** preset oluştur/kaydet/yeniden adlandır/kopyala/içe-dışa aktar/sil; örnekleme & kanal bilgileri; teşhis ekranı (cihaz / aktif filtreler / işleme / STT bağlantısı).
- **S8 — macOS doğrulama + dokümantasyon:** Mac'te cihaz akışı testi, platform farkları, lisans notları (`docs/`), README güncellemesi.

## 8. Kabul kriterleri (prompt → kontrol listesi)

- [ ] Gerçek mikrofon seçilebiliyor; seçim yeniden başlatmada hatırlanıyor
- [ ] Canlı meter'lar gerçek sesi gösteriyor (ham + işlenmiş ayrı)
- [ ] Güvenli, açık istekli dinleme (monitor) çalışıyor
- [ ] Çekirdek filtreler gerçek örnekleri değiştiriyor (test kanıtlı)
- [ ] Çalışırken filtre ayarı değiştirilebiliyor (tık/pop yok)
- [ ] İşlenmiş ses STT'ye ulaşıyor (mevcut sağlayıcıyla)
- [ ] Presetler yeniden başlatmada duruyor
- [ ] Cihaz kopması çökmeden yönetiliyor
- [ ] UI gerçek işleme durumunu yansıtıyor (sahte kontrol yok)
- [ ] Windows/macOS sınırları dokümante ve test edildi (Mac: S8)

## 9. Riskler

- **Regresyon (kilit/donma):** karar kaynağı ham kalır + watchdog; S1'de eski katman sökülürken ham→karar testi korunur.
- **Geri besleme:** monitor varsayılan kapalı + uyarı; TTS çıkışının zincire sızması mümkün değil (ayrı bağlam).
- **Gecikme/CPU:** işlem worklet'te (UI thread'de değil); görselleştirme sınırlı FPS; hedef toplam işleme gecikmesi <30ms.
- **RNNoise:** lisans (BSD-3) uygun, boyut küçük; 48k/10ms çerçeve dönüşümü dikkat ister.
- **Kapsam:** prompt geniş; aşamalar kullanıcı denemesiyle ilerler — her aşama tek başına "bitmiş" iş teslim eder.

## 10. Sonraki adım

Kullanıcı "başla" dediğinde **S1** ile başlanır (iskelet + eski katmanın sökülmesi). S1 sonunda mikrofon davranışı aynı kalmalı: kazanç nötr, kilitlenme imkânsız, uyandırma/STT çalışır durumda.
