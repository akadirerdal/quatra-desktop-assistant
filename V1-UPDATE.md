# Quatra — Vol 1 Update · v1 Kapsam Listesi

> v1 sürümüne kadar yapılacak tüm işlerin tek listesi. İki kaynaktan birleştirildi:
> **👤 kullanıcı bildirimleri (Tur 7)** + **🔧 geliştirici tespitleri (v1 öncelik analizi)**.
> Durum: ⬜ başlanmadı · 🟡 devam ediyor · ✅ bitti. Bir madde bitince `EKSIKLER.md`’nin ✅ bölümüne de işlenir.
> **Son güncelleme:** 16.10.2026 (Tur 10)
> **Durum:** A ✅ (V1-01…05), B ✅ (V1-06 streaming, V1-07 “sus”, V1-09 sözlü izin), C ✅ (V1-10 bağlam, V1-11 hatırlatıcı, V1-12 yedek sağlayıcı), D ✅ (V1-13 tepsi, V1-14 otomatik başlatma), F ✅ (V1-17 işlem günlüğü, V1-18 not yedeği, V1-19 token sayaçları); V1-08 yerel uyandırma → paketleme aşamasına bırakıldı (SORULAR #5). E: V1-15 🟡 (favori/eleme sende), V1-16 ✅. G (V1-20/21 NSIS + güncelleme): ürün bitince. Sıradaki: E görsel turu + Şafak kontrast + ölü kontrol artığı avı.

---

## A. Mikrofon & Ses Girişi Paketi
- ✅ **V1-01 · Mikrofon testi ekranı** — Ayarlar → Ses ve Giriş: canlı seviye çubuğu + 3 sn test kaydı + dinleme + aktif cihaz adı; test mevcut ayarlarla (cihaz+kazanç+kapı) çalışır, “Testi bitir” uyandırma bekleyişine döner. 👤 → (Tur 10)
- ✅ **V1-02 · Kademeli ayarlar** — yazılım katmanı: ek kazanç (kapalı/zayıf/orta/güçlü) + eşikli gürültü kapısı (400 ms tutuşlu); GERÇEK kayda uygulanır (MediaStreamDestination). Tarayıcı filtreleri aç/kapa kaldı. 👤 → (Tur 10)
- ✅ **V1-03 · Mikrofon cihazı seçimi** — Ayarlar → Ses ve Giriş’te cihaz listesi (enumerateDevices + devicechange yenileme); seçili cihaz kayıt zincirinde exact kısıt; cihaz kaybolursa dürüst log + varsayılana düşme. 🔧 → (Tur 10)
- ✅ **V1-04 · Sürekli açık mikrofon davranışı** — wake modunda mikrofon açık; “uyu / dinlemeyi bırak / bekleme moduna geç” sesli komutu sohbeti bitirip «Quatra» bekleyişine döndürür (mikrofon açık kalır); MIC ile susturma korunur. 👤 → (Tur 10)
- ✅ **V1-05 · Uyku süresi ayarı** — yeni ayar `sleepAfterSec` (2–30 sn, varsayılan 5 sn); sohbet içi sessizlikte bu süre sonunda uyku; Ayarlar → Ses ve Giriş’te kaydırıcı. 👤 → (Tur 10)

## B. Sesli Deneyim Çekirdeği
- ✅ **V1-06 · Yanıt akışı (streaming)** — agent SSE ile akışı okur; tamamlanan her cümle anında TTS kuyruğuna girer (MediaStream sırası), ilk ses gecikmesi düşer. Yarım cümle zorla bölünmez (“3.5” korunur); tool turlarında asılı metin TTS’e verilmez. 🔧 → (Tur 10)
- ✅ **V1-07 · “Sus” komutu** — “sus / sussana / kes sesini / sesini kes / sessiz ol / konuşma / dur / yeter (artık)” sesli durdurma; konuşma sürerken barge-in ile zincirlenir; TTS kuyruğu temizlenir, bağlam korunur. 🔧 → (Tur 10)
- 🟡 **V1-08 · Yerel uyandırma kelimesi** — yerel model (KWS/whisper.cpp) gömülmesi ~MB’larca paket + yeni bağımlılık ister; mevcut sistem internetli çalışıyor. Paketleme aşamasında değerlendirilecek (SORULAR #5). 🔧
- ✅ **V1-09 · Sözlü izin akışı** — ekran kutusu YOK: `agent:confirm` olayı → Quatra sesle sorar, “evet/hayır” sesle yanıtlanır (20 sn sınır; 2 anlaşılmaz yanıtta güvenli ret); araç adları Türkçe etiketlenir. 👤 → (Tur 10)

## C. Zeka & Konuşma
- ✅ **V1-10 · Kısa süreli konuşma bağlamı** — son 6 tur (toplam ≤4000 karakter) prompt'a eklenir; takip soruları (“peki ya yarın?”) anlaşılır. Bağlam yalnız RAM'de tutulur — diske yazılmaz. 🔧 → (Tur 10)
- ✅ **V1-11 · Hatırlatıcı / zamanlayıcı** — “10 dakika sonra … hatırlat”, “alarm kur” (2 sn – 24 saat; iki parçalı süre desteği); sesli onay + görev balonu; süre dolunca sesle + yazıyla haber verir. 🔧 → (Tur 10)
- ✅ **V1-12 · Yedek sağlayıcı + zarif hata** — DeepSeek GEÇİCİ hatasında (ağ / zaman aşımı / sunucu / hız limiti / anahtar) Groq'a otomatik yedek; ikisi de yanıt vermezse hata SESLİ bildirilir (“şu an bağlanamıyorum”). 🔧 → (Tur 10)

## D. Arka Plan & Başlangıç
- ✅ **V1-13 · Tepsi simgesi + arka planda yaşam** — window close = tepsiye in (uygulama ölmez); tepsi menüsü (Göster / Mikrofon / Ayarlar / Çıkış); ilk inişte bildirim; `backgroundThrottling:false` ile arka planda tam hız. 🔧 → (Tur 10)
- ✅ **V1-14 · Windows açılışında otomatik başlatma** — Ayarlar → Genel'de anahtar; gerçek durum işletim sisteminden okunur; kurulu (paketlenmiş) sürümde etkin, kaynak modda dürüst “desteklenmez” notu. 👤🔧 → (Tur 10)

## E. Görsel & Kişiselleştirme *(karar birlikte)*
- 🟡 **V1-15 · Tema sistemi** — 7 hazır tema uygulandı (Gece Moru, Okyanus, Zümrüt, Gün Batımı, Gül, Grafit, Şafak); Ayarlar → Görünüm'den canlı deneniyor. Kalan: senin turun + ince ayar (favoriler kalır, istemediklerin çıkar). 👤
- ✅ **V1-16 · Mikrofon kapatma simgesi yenilendi** — “Ekolayzır” (C) düğmesi: 4 çubuk gerçek mikrofon seviyesiyle oynar; muted görselindeki kırmızı çapraz çizgi kaldırıldı (sakin, kesikli çizgi). Kullanıcı kabul etti (“idare eder”, 16.10). 👤

## F. Güvenlik & Güven
- ✅ **V1-17 · İşlem günlüğü (audit)** — her tool işi kalıcı kayda düşer (yerel `audit.jsonl`, redact'lı, son 800 kayıt); Ayarlar → yeni “İşlem Kaydı” bölümünde listelenir/temizlenir. 🔧 → (Tur 10)
- ✅ **V1-18 · Dosya yazımında yedek/geri alma** — bir notun üzerine yazılmadan önce `.bak` kopyası alınır; İşlem Kaydı → “Geri al” ile dönülür (aynı klasör güvenlik doğrulaması). 🔧 → (Tur 10)
- ✅ **V1-19 · Maliyet/token görünürlüğü** — sağlayıcı usage bildirdiğinde aylık + toplam token sayaçları görünür (uydurma sayı yok). 🔧 → (Tur 10)

## G. Dağıtım
- ⬜ **V1-20 · Kurulum dosyası (NSIS)** — v1’in çift tıkla kurulabilir olması. 🔧
- ⬜ **V1-21 · Otomatik güncelleme** — yeni sürüm kendiliğinden gelir. 🔧

---

## H. v1’de değerlendirilecek (karar bekliyor)
- ⬜ **Tarayıcı köprüsü** — internette sayfa okuma; hava durumu/haber gibi güncel bilgi. (Phase 2)
- ⬜ **Konuşma geçmişi görünümü** — geçmiş konuşmalar okunabilsin (gizlilik ayarıyla, varsayılan kapalı).
- ⬜ **Hafıza iyileştirme paketi** — anlamsal tekrar yakalama, “bunu unut” sesli silme, kayıt düzenleme.

## I. v1 sonrası (bilinçli kapsam dışı)
macOS desteği · çok dillilik · medya/sistem ses kontrolü · dosya işlemleri (oku/ara/taşı) · ekran görüntüsü · e-posta/mesaj gönderme

---

_Not: Bu liste canlıdır. Sen incelemeye devam ettikçe yeni bildirimler işlenir; bir madde tamamlanınca ✅ olur ve `EKSIKLER.md` ile birlikte güncellenir._
