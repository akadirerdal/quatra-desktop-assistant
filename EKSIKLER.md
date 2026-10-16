# Quatra — Eksikler Listesi

> Bu dosya iki kaynaktan beslenir: **(1)** kullanıcının inceleme sırasında bildirdiği eksikler, **(2)** geliştirme tarafında bilinen ve dürüstçe belgelenmiş sınırlar.
> Her geliştirme turunda güncellenir; bir madde çözülünce ilgili yerden çıkarılıp ✅ bölümüne taşınır.
> Son güncelleme: 16.10.2026 · Durum işaretleri: ⬜ açık · 🟡 kısmen var · ✅ çözüldü

---

## İlk sürüm (v1) için öncelik önerisi — geliştirici görüşü (16.10.2026)

Kullanıcının sorusu üzerine: bence v1’den önce çözülmesi gerekenler, önem sırasıyla:

1. ✅ **Konuşma bağlamı** — çözüldü (V1-10, Tur 10): son turlar bağlam olarak ekleniyor; “peki ya yarın?” anlaşılır.
2. ✅ **Hatırlatıcı / zamanlayıcı** — çözüldü (V1-11, Tur 10): “10 dakika sonra … hatırlat / alarm kur” sesli + görsel çalışır.
3. ✅ **Yanıt akışı + “sus” komutu** — çözüldü (V1-06/07, Tur 10): cümle cümle seslendirme + sesli durdurma.
4. **Uyandırma kelimesinin yerelleşmesi** — “Quatra” demek bile internet turu; internet yokken asistan tümüyle sağır. Yerel uyandırma modeli gecikmeyi ve bağımlılığı bitirir. (Tur 10: paketleme aşamasına bırakıldı.)
5. ✅ **Yedek sağlayıcı + zarif hata** — çözüldü (V1-12, Tur 10): geçici DeepSeek kesintisinde Groq'a yedek geçiş; hata net ve sesli.
6. **Tepsi + arka plan + otomatik başlatma** — asistan “her an orada” olmalı; kullanıcı da otomatik başlatma istedi (bkz. §9).
7. **Kurulum dosyası + otomatik güncelleme** — v1’in dağıtılabilir olması için; şu an yalnız kaynak koddan çalışıyor.
8. ✅ **İşlem günlüğü + dosya yedeği/geri alma** — çözüldü (V1-17/18, Tur 10): işlem kaydı + not yedeği/geri alma gerçek çalışır.
9. ✅ **Maliyet/token görünürlüğü** — çözüldü (V1-19, Tur 10): aylık + toplam token sayaçları İşlem Kaydı bölümünde.

_Bu sıralama §9’daki kullanıcı maddeleriyle birleştirilip **`V1-UPDATE.md`** olarak ayrı listeye alındı — v1 kapsamının tek doğru kaynağı artık V1-UPDATE.md’dir._

---

## 1. Sesli deneyim
- ⬜ **Uyandırma kelimesi buluta bağlı** — “Quatra” tespiti bile Groq Whisper’a gidip gelir; internet yokken uyandırma çalışmaz. (Tur 10 notu: yerel KWS model gömülmesi gerektirir → paketleme aşamasına bırakıldı; SORULAR #5.)
- ⬜ **Sistem ses seviyesi / medya kontrolü yok** — “sesi kıs”, “şarkı değiştir” desteklenmiyor.
- ⬜ **Yalnızca Türkçe** — başka dilde konuşma/arayüz yok.

## 2. Konuşma anlayışı
- ⬜ **İnternetten güncel bilgi yok** — hava durumu, haber, fiyat gibi sorularda yalnız modelin kendi bilgisi var. (Phase 2 — tarayıcı köprüsü)

## 3. Araçlar / yetenekler
- ⬜ **Dosya işlemleri asgari** — yalnız not yazma var; okuma, arama, taşıma, silme yok.
- ⬜ **Ekran görüntüsü alma yok.**
- ⬜ **Web sayfası okuma/özetleme yok** — tarayıcı köprüsü gelince gelecek.
- ⬜ **Uygulama açma 7 uygulamayla sınırlı** — not defteri, hesap makinesi, dosya gezgini, komut istemi, PowerShell, Paint, Görev Yöneticisi. Liste kullanıcı onayıyla genişletilebilir.

## 4. Hafıza
- ⬜ **Anlamsal tekrar yakalama yok** — aynı bilgi farklı kelimelerle iki kez kaydolabilir (ör. “efendim demesi” tercihi iki kayıt olarak duruyor). Çözüm: model tabanlı benzerlik kontrolü.
- ⬜ **Tek kayıt silme sesli komutu yok** — “bunu unut” henüz yok; silme Ayarlar → Hafıza listesinden yapılıyor.
- ⬜ **Kayıt düzenleme yok** — metin değiştirmek için silip yeniden eklemek gerekiyor.
- ⬜ **Hafızada arama/filtreleme yok** — kayıt sayısı artınca gerekli olacak.

## 5. Arayüz
- ⬜ **Konuşma geçmişi görüntülenemiyor** — altyazılar kaybolduktan sonra geriye dönük okunamıyor (chat panelli tasarım bilinçli olarak yok; istenirse “geçmiş” görünümü eklenir). (Karar bekliyor — SORULAR/V1-UPDATE-H.)
- ⬜ **Yazıyla komut girişi yok** — bilinçli (ses öncelikli); klavye girişi alanı opsiyonel olarak eklenebilir.

## 6. Güvenlik ve veri

## 7. Platform / kurulum
- ⬜ **macOS hiç test edilmedi** — Windows için geliştirildi.
- ⬜ **Final kurulum dosyası henüz yok** — şu an kaynak koddan çalışıyor; NSIS kurulum ürün bitince üretilecek.
- ⬜ **Otomatik güncelleme yok.**

## 8. Altyapı
- ⬜ **Çevrimdışı mod yok** — sistem TTS dışında beyin ve ses tanıma internet ister.

## 9. Kullanıcı incelemesinden gelenler
> İnceleme sırasında bildirdiğin eksikler buraya tarihiyle işlenir; çözülenler ✅ bölümüne taşınır.
> **Not:** Tur 7’deki tüm maddeler v1 planına alındı → bkz. `V1-UPDATE.md`.

### Tur 7 — 16.10.2026 (kullanıcı bildirimleri — “şimdilik sadece not et”)

1. ✅ **Mikrofon testi ekranı** — canlı seviye + 3 sn test kaydı + dinleme + aktif cihaz adı; Ayarlar → Ses ve Giriş’te. (Tur 10 → V1-01)
2. ✅ **Kademeli ayarlar** — yazılım katmanı: ek kazanç (kapalı/zayıf/orta/güçlü) + eşikli gürültü kapısı; gerçek kayda uygulanır. (Tur 10 → V1-02)
3. ✅ **Mikrofon davranışı** — mikrofon açık kalır; “uyu” komutuyla sohbet biter, «Quatra» bekleyişine dönülür; “mikrofon açık” diye uykuya dönmeme kalmadı. (Tur 10 → V1-04)
4. ✅ **Uyku süresi ayarı** — Ayarlar → Ses ve Giriş’te 2–30 sn kaydırıcı (varsayılan 5 sn); sohbet içi sessizlik süresini belirler. (Tur 10 → V1-05)
5. 🟡 **Daha fazla tema** — hazır renk temaları/paletler. _(Tur 9: tema motoru yazıldı; 7 hazır tema Ayarlar → Görünüm'den canlı deneniyor; ince ayar sende → V1-15)_
6. ✅ **Mikrofon kapatma simgesi yenilendi** — C · Ekolayzır düğmesi uygulandı; ortadaki kırmızı çapraz çizgi (muted görseli) kaldırıldı; kullanıcı kabul etti (“idare eder”). → çözülenlere taşındı
7. ✅ **Windows açılışında otomatik başlatma** — uygulandı (Tur 10 → V1-14): Ayarlar → Genel'de anahtar; bilgisayar açılınca Quatra başlar ve tepside bekler. Yalnız kurulu (paketlenmiş) sürümde etkin; kaynak modda dürüstçe “desteklenmez” der.
8. ✅ **İzin istekleri sözlü olsun** — uygulandı (Tur 10 → V1-09): ekran onayı kaldırıldı; Quatra sesle sorar, “evet/hayır” ile yanıtlanır (20 sn zaman aşımı → güvenli ret).

### Tur 10 — 16.10.2026 akşamı (kullanıcı bildirimi)

1. ✅ **KRİTİK — uygulamada mikrofon “ölü”: ses hiç alınmıyordu** — bildirim (16.10): “Windows’ta ses temiz, uygulamada ses yok; test ettim, bazen alıyor ama çoğu zaman hiç almıyor.”
   **Kök sebep:** gürültü kapısı (kullanıcıda “düşük” açık) seviyeyi kazanç düğümünden **sonra** ölçüyordu; kapı kapandığı anda seviye ~0 okunuyor ve kapı bir daha açılamıyordu (kendini kilitliyordu) → tüm kayıtlar sonsuza dek “sessizlik”. Log kanıtı: art arda `kayıt sonu: sessizlik`.
   **Düzeltme (Tur 10 ek):** analyser ham kaynağa taşındı (kazançtan önce → kapı ham seviyeyle karar verir, kilitlenemez); askıya düşen AudioContext kendiliğinden resume ediliyor; kopan cihaz akışı (çıkarılan mikrofon) otomatik yeniden açılıyor. Regresyon testleri: kapı kararı (+4), zincir bağlantısı (+3). **Gerçek mikrofonla son doğrulama: kullanıcıda.**
2. ✅ **Mikrofon kalibrasyonu (ölçümle, 16.10):** “Kendin ses vererek test edip botun en rahat anlayacağı ayarları yap” istemiyle: `scripts/mic-tanilama.cjs` hoparlörden test cümlesi çalınırken gerçek Chromium hattıyla ölçtü (3 profil × 40 sn). Bulgular: **oto kazanç bu makinede kritik** (konuşma tepesi 0.45 ↔ kapalıyken 0.05), **gürültü bastırma yararlı** (ortam sıçramaları 0.135→0.101), ortam tabanı çok sakin (~0.017-0.019). Uygulanan: hassasiyet 6→**8**, gürültü kapısı “düşük”→**kapalı**; NS/AEC/AGC açık kaldı. Ek yazılım (NVIDIA Broadcast) şu an gereksiz — veri temiz.
3. ✅ **Mac’e kurulum (“bunu Mac’e direkt nasıl yüklerim?”)** — iki yol netleştirildi ve repo tarafı hazırlandı: (1) kaynaktan çalıştırma (Node LTS + `git clone` + `npm install` + `npm run dev:electron`), (2) gerçek uygulama: `npm run package:mac` → DMG (yalnız macOS’ta üretilir). Hazırlananlar: `build.mac` bloğu (dmg · `NSMicrophoneUsageDescription` · imzasız yerel derleme), macOS tepsi simgesi (`tray.png` + retina `@2x`), platforma duyarlı mikrofon izni mesajı, paket simgesi `build/icon.png`; ayrıca `files` listesine `build/**/*` eklendi (kurulu sürümde tepsi simgesi eksik kalıyordu — Windows NSIS’i de düzeltir). İlk çalıştırmada macOS mikrofon iznini sorar; reddedilirse mesaj artık macOS yolunu gösterir. Tek eksik: `open_app` aracının macOS uygulama eşlemesi (sıradaki iş).

_(Yeni bildirim geldikçe buraya eklenir.)_

## ✅ Çözülenler
- ✅ **(Tur 9, 16.10) Ölü görünüm kontrolleri gerçek oldu** — vurgu rengi artık tüm arayüze uygulanıyor (eskiden yalnızca visualizer çizimine gidiyordu); "Arayüz ölçeği" ve "Hareketi azalt" artık gerçekten etkili; tema altyapısı eklendi (7 tema) → V1-15.
- ✅ **(Tur 9, 16.10) Mikrofon düğmesi yenilendi (V1-16)** — eski MIC rozeti yerine “Ekolayzır” (C) düğmesi: 4 çubuk dinlerken gerçek mikrofon seviyesiyle oynar; muted görselindeki kırmızı çapraz çizgi kaldırıldı (sakin, kesikli çizgi). Kullanıcı kabul etti.
- ✅ **(Tur 10, 16.10) Hafıza silme koruması** — `remove`/`clear` artık dosyayı silmeden önce `memory.json.bak` yedeği bırakıyor; silme olayları log’a düşüyor (sessiz veri kaybı bitti). Ayrıca 16.10’da sessizce boşaltılan hafıza geri yüklendi (6 kayıt).
- ✅ **(Tur 10, 16.10) Not (`not_al`) klasör dayanıklılığı** — modelin uydurduğu var olmayan klasör yok sayılır; hatırlanan klasör (notes-dir.txt) otomatik kullanılır; yoksa kullanıcıya seçtirilir ve seçim hatırlanır. “Hedef klasör mevcut değil.” hatası bitti.
- ✅ **(Tur 10, 16.10) A paketi — mikrofon & ses girişi (V1-01…V1-05)** — mikrofon testi (canlı seviye + test kaydı + dinleme + aktif cihaz adı), cihaz seçimi (devicechange ile yenileme; kayıp cihazda varsayılana düşme), kademeli yazılım katmanı (ek kazanç + gürültü kapısı — gerçek kayda uygulanır), “uyu” sesli komutu + yapılandırılabilir uyku süresi (varsayılan 5 sn).
- ✅ **(Tur 10, 16.10) Yanıt akışı — streaming + cümle cümle seslendirme (V1-06)** — yanıt üretilirken tamamlanan her cümle anında TTS kuyruğuna girer; ilk ses gecikmesi düşer. “sus” bu kuyruktaki cümleleri de iptal eder.
- ✅ **(Tur 10, 16.10) “Sus” komutu (V1-07)** — “sus / kes sesini / sessiz ol / konuşma / dur / yeter” sesli durdurma; okuma sırasında söylenirse barge-in ile zincirlenir; sohbet bağlamı korunur.
- ✅ **(Tur 10, 16.10) Sözlü izin akışı (V1-09)** — ekran onay kutusu kaldırıldı; Quatra sesle sorar (“Şunun için izin gerekiyor: … Evet mi, hayır mı?”); “evet/hayır” sesle yanıtlanır; 20 sn cevap gelmezse işlem yapılmaz (SORULAR #10).
- ✅ **(Tur 10, 16.10) Kısa süreli konuşma bağlamı (V1-10)** — son 6 tur (≤4000 karakter) prompt'a eklenir; “peki ya yarın?” gibi takip cümleleri anlaşılır. Bağlam yalnız RAM'de tutulur — diske yazılmaz.
- ✅ **(Tur 10, 16.10) Hatırlatıcı / zamanlayıcı (V1-11)** — “10 dakika sonra … hatırlat / alarm kur” (2 sn – 24 saat): sesli onay + görev balonu; süre dolunca sesle + yazıyla haber verir.
- ✅ **(Tur 10, 16.10) Yedek sağlayıcı + zarif hata (V1-12)** — DeepSeek geçici kesintisinde (ağ/zaman aşımı/sunucu/hız limiti/anahtar) Groq'a otomatik geçiş; ikisi de düşerse hata SESLİ bildirilir (sessiz kalmaz).
- ✅ **(Tur 10, 16.10) Tepsi + arka planda yaşam (V1-13)** — pencere kapatılınca uygulama kapanmaz, tepsiye iner (ilk inişte bir kez bilgilendirme). Tepsi menüsü: Göster · Mikrofon Aç/Kapat · Ayarları Aç · Çıkış. Arka planda zamanlayıcılar kısılmaz (`backgroundThrottling:false`). Mikrofon durumu kullanıcıda kalır — tepsi kendiliğinden dinlemeye başlamaz.
- ✅ **(Tur 10, 16.10) Windows açılışında otomatik başlatma (V1-14)** — Ayarlar → Genel'de anahtar; durum işletim sisteminden okunur; yalnız kurulu (paketlenmiş) sürümde etkin — kaynak modda dürüstçe “desteklenmez” der.
- ✅ **(Tur 10, 16.10) İşlem günlüğü (V1-17)** — yapılan her tool işi kalıcı kayda düşer (yerel `audit.jsonl`, secret'lar redact, son 800); Ayarlar → İşlem Kaydı'ndan görüntülenir/temizlenir.
- ✅ **(Tur 10, 16.10) Not yedeği / geri alma (V1-18)** — mevcut bir notun üzerine yazılmadan önce `.bak` kopyası alınır; İşlem Kaydı'ndan tek tıkla geri alınır (aynı klasör doğrulamasıyla).
- ✅ **(Tur 10, 16.10) Token sayaçları (V1-19)** — sağlayıcı usage bildirdiğinde aylık + toplam giriş/çıkış tokenları ve istek sayısı İşlem Kaydı'nda görünür.
- ✅ **(Tur 10, 16.10) Ölü kontroller gerçek yapıldı** — “Konuşma bağlamını temizle”, “Günlükleri temizle” ve “Konuşma metinlerini sakla” (opt-in, `transcripts.jsonl`) artık gerçekten çalışıyor; “Konuşma kayıtlarını sil” eklendi.
- ✅ **(Tur 10, 16.10) Şafak (aydınlık) tema (V1-15)** — açık tema eksikliği kapandı: Şafak teması kontrast turundan geçti (metin/ikincil metin/vurgu okunaklı); favori/eleme senin incelemede (SORULAR #2).
- ✅ **(Tur 10, 16.10) Ayarları dışa/içe aktarma** — Ayarlar → Genel: JSON olarak dışa aktar / içe aktar; API anahtarları dosyaya DAHİL DEĞİL (ayrı vault'ta).
