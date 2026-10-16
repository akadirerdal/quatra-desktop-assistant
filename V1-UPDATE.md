# Quatra — Vol 1 Update · v1 Kapsam Listesi

> v1 sürümüne kadar yapılacak tüm işlerin tek listesi. İki kaynaktan birleştirildi:
> **👤 kullanıcı bildirimleri (Tur 7)** + **🔧 geliştirici tespitleri (v1 öncelik analizi)**.
> Durum: ⬜ başlanmadı · 🟡 devam ediyor · ✅ bitti. Bir madde bitince `EKSIKLER.md`’nin ✅ bölümüne de işlenir.
> **Son güncelleme:** 16.10.2026 (Tur 10)
> **Durum:** A paketi ✅ kapandı (V1-01…V1-05). E paketinden V1-15 tema 🟡 (ince ayar kullanıcıda), V1-16 ✅. Önerilen sonraki: B paketi (V1-06 streaming, V1-07 “sus”).

---

## A. Mikrofon & Ses Girişi Paketi
- ✅ **V1-01 · Mikrofon testi ekranı** — Ayarlar → Ses ve Giriş: canlı seviye çubuğu + 3 sn test kaydı + dinleme + aktif cihaz adı; test mevcut ayarlarla (cihaz+kazanç+kapı) çalışır, “Testi bitir” uyandırma bekleyişine döner. 👤 → (Tur 10)
- ✅ **V1-02 · Kademeli ayarlar** — yazılım katmanı: ek kazanç (kapalı/zayıf/orta/güçlü) + eşikli gürültü kapısı (400 ms tutuşlu); GERÇEK kayda uygulanır (MediaStreamDestination). Tarayıcı filtreleri aç/kapa kaldı. 👤 → (Tur 10)
- ✅ **V1-03 · Mikrofon cihazı seçimi** — Ayarlar → Ses ve Giriş’te cihaz listesi (enumerateDevices + devicechange yenileme); seçili cihaz kayıt zincirinde exact kısıt; cihaz kaybolursa dürüst log + varsayılana düşme. 🔧 → (Tur 10)
- ✅ **V1-04 · Sürekli açık mikrofon davranışı** — wake modunda mikrofon açık; “uyu / dinlemeyi bırak / bekleme moduna geç” sesli komutu sohbeti bitirip «Quatra» bekleyişine döndürür (mikrofon açık kalır); MIC ile susturma korunur. 👤 → (Tur 10)
- ✅ **V1-05 · Uyku süresi ayarı** — yeni ayar `sleepAfterSec` (2–30 sn, varsayılan 5 sn); sohbet içi sessizlikte bu süre sonunda uyku; Ayarlar → Ses ve Giriş’te kaydırıcı. 👤 → (Tur 10)

## B. Sesli Deneyim Çekirdeği
- ⬜ **V1-06 · Yanıt akışı (streaming)** — cevap cümle cümle seslendirilir; uzun yanıtta ilk ses gecikmesi büyük ölçüde düşer. 🔧
- ⬜ **V1-07 · “Sus” komutu** — sesli durdurma (“sus”, “kes sesini”, “dur”); barge-in’i tamamlar. 🔧
- ⬜ **V1-08 · Yerel uyandırma kelimesi** — “Quatra” tespiti internet olmadan cihazda çalışsın; V1-04’ün ön şartı, gecikmeyi ve internet bağımlılığını bitirir. 🔧
- ⬜ **V1-09 · Sözlü izin akışı** — izin gerektiğinde ekranda baloncuk/görev kartı YOK; Quatra sesle sorar (“Not alayım mı?”), “evet/hayır” ile onay alınır. 👤

## C. Zeka & Konuşma
- ⬜ **V1-10 · Kısa süreli konuşma bağlamı** — son konuşma turları hatırlanır; takip soruları (“peki ya yarın?”) anlaşılır; token bütçesi sınırlı tutulur. 🔧
- ⬜ **V1-11 · Hatırlatıcı / zamanlayıcı** — “10 dakika sonra hatırlat”, “alarm kur”; hatırlatma sesli + görsel gelsin. 🔧
- ⬜ **V1-12 · Yedek sağlayıcı + zarif hata** — DeepSeek kesintisinde Quatra sessiz kalmaz: ikinci sağlayıcıya geçer ya da net sesli hata verir (“şu an bağlanamıyorum”). 🔧

## D. Arka Plan & Başlangıç
- ⬜ **V1-13 · Tepsi simgesi + arka planda yaşam** — pencere kapatılınca uygulama ölmez; tepside çalışır, dinlemeye devam eder. 🔧
- ⬜ **V1-14 · Windows açılışında otomatik başlatma** — bilgisayar kapanıp açıldığında Quatra kendiliğinden başlar; Ayarlar’dan aç/kapat. 👤🔧

## E. Görsel & Kişiselleştirme *(karar birlikte)*
- 🟡 **V1-15 · Tema sistemi** — 7 hazır tema uygulandı (Gece Moru, Okyanus, Zümrüt, Gün Batımı, Gül, Grafit, Şafak); Ayarlar → Görünüm'den canlı deneniyor. Kalan: senin turun + ince ayar (favoriler kalır, istemediklerin çıkar). 👤
- ✅ **V1-16 · Mikrofon kapatma simgesi yenilendi** — “Ekolayzır” (C) düğmesi: 4 çubuk gerçek mikrofon seviyesiyle oynar; muted görselindeki kırmızı çapraz çizgi kaldırıldı (sakin, kesikli çizgi). Kullanıcı kabul etti (“idare eder”, 16.10). 👤

## F. Güvenlik & Güven
- ⬜ **V1-17 · İşlem günlüğü (audit)** — Quatra’nın yaptığı işlerin kalıcı ve görüntülenebilir kaydı. 🔧
- ⬜ **V1-18 · Dosya yazımında yedek/geri alma** — yanlış yazılan not geri alınabilir. 🔧
- ⬜ **V1-19 · Maliyet/token görünürlüğü** — kullanım şeffaflığı (aylık özet). 🔧

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
