# Quatra — Vol 1 Update · v1 Kapsam Listesi

> v1 sürümüne kadar yapılacak tüm işlerin tek listesi. İki kaynaktan birleştirildi:
> **👤 kullanıcı bildirimleri (Tur 7)** + **🔧 geliştirici tespitleri (v1 öncelik analizi)**.
> Durum: ⬜ başlanmadı · 🟡 devam ediyor · ✅ bitti. Bir madde bitince `EKSIKLER.md`’nin ✅ bölümüne de işlenir.
> **Son güncelleme:** 16.10.2026
> **Önerilen başlangıç:** A paketi (mikrofon — senin önceliğin ve bağımsız çalışılabilir), hemen ardından V1-10 (konuşma bağlamı). Kesin sıra birlikte netleştirilecek.

---

## A. Mikrofon & Ses Girişi Paketi
- ⬜ **V1-01 · Mikrofon testi ekranı** — “konuş, seviyeyi gör, ayarla”: canlı seviye çubuğu + test kaydı + kaydı dinleme; Ayarlar → Ses ve Giriş içinde. 👤
- ⬜ **V1-02 · Kademeli ayarlar** — kazanç ve gürültü engelleme yalnız açık/kapalı değil, seviyeli olsun (zayıf/orta/güçlü…). *Teknik:* tarayıcı filtreleri temelde aç/kapa kalır; kademeler bizim yazılım katmanımızda (kazanç kademesi + eşikli gürültü kapısı) uygulanır. 👤
- ⬜ **V1-03 · Mikrofon cihazı seçimi** — sistemde birden fazla mikrofon varsa seçim listesi (şu an her zaman varsayılan cihaz). 🔧
- ⬜ **V1-04 · Sürekli açık mikrofon davranışı** — mikrofon fiziksel olarak hep açık kalır (konuşsak da konuşmasak da); Quatra yalnız “Quatra” deyince tetiklenir; “mikrofon açık” diye uykuya dönmeyi reddetmez. *Not:* MIC ile susturma hakkı korunur; dinleme durumu görünür kalmalı. 👤
- ⬜ **V1-05 · Uyku süresi ayarı** — kullanıcıdan ses gelmezse uykuya dönme süresi; **varsayılan 5 sn**, Ayarlar’dan her kullanıcı kendine göre değiştirebilir. 👤

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
- ⬜ **V1-15 · Tema sistemi** — hazır temalar/paletler (şu an: koyu tema + tek vurgu rengi). İçerik ve tarz birlikte tartışılacak. 👤
- ⬜ **V1-16 · Mikrofon kapatma simgesi yenilenmeli** — mevcut MIC rozeti beğenilmedi; tasarım birlikte tartışılacak. 👤

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
