# Quatra — Eksikler Listesi

> Bu dosya iki kaynaktan beslenir: **(1)** kullanıcının inceleme sırasında bildirdiği eksikler, **(2)** geliştirme tarafında bilinen ve dürüstçe belgelenmiş sınırlar.
> Her geliştirme turunda güncellenir; bir madde çözülünce ilgili yerden çıkarılıp ✅ bölümüne taşınır.
> Son güncelleme: 16.10.2026 · Durum işaretleri: ⬜ açık · 🟡 kısmen var · ✅ çözüldü

---

## 1. Sesli deneyim
- ⬜ **Uyandırma kelimesi buluta bağlı** — “Quatra” tespiti bile Groq Whisper’a gidip gelir; internet yokken uyandırma çalışmaz. (Çözüm yolu: yerel küçük uyandırma modeli.)
- ⬜ **Yanıtlar canlı akıtılmıyor** — cevabın tamamı üretilmeden seslendirme başlamaz; uzun yanıtta ilk ses gecikmesi büyür. (Cümle cümle akış planlı.)
- ⬜ **“Sus / kes sesini” komutu yok** — Quatra ancak üstüne konuşunca susar (barge-in); açık bir durdurma komutu eklenebilir.
- ⬜ **Sistem ses seviyesi / medya kontrolü yok** — “sesi kıs”, “şarkı değiştir” desteklenmiyor.
- ⬜ **Yalnızca Türkçe** — başka dilde konuşma/arayüz yok.

## 2. Konuşma anlayışı
- ⬜ **Kısa süreli bağlam yok** — her komut bağımsız değerlendirilir; “peki ya yarın?”, “bunu biraz kısalt” gibi takip cümleleri anlaşılmaz. (Phase 3)
- ⬜ **İnternetten güncel bilgi yok** — hava durumu, haber, fiyat gibi sorularda yalnız modelin kendi bilgisi var. (Phase 2 — tarayıcı köprüsü)

## 3. Araçlar / yetenekler
- ⬜ **Hatırlatıcı / zamanlayıcı / alarm yok** — “10 dakika sonra hatırlat” gibi klasik asistan istekleri şu an desteklenmiyor. (En belirgin eksik.)
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
- ⬜ **Konuşma geçmişi görüntülenemiyor** — altyazılar kaybolduktan sonra geriye dönük okunamıyor (chat panelli tasarım bilinçli olarak yok; istenirse “geçmiş” görünümü eklenir).
- ⬜ **Açık tema yok** — yalnız koyu tema; vurgu rengi değiştirilebiliyor.
- ⬜ **Tepsi (system tray) simgesi yok** — pencereyi kapatınca uygulama tümüyle kapanır; arka planda “kulak” kalmaz.
- ⬜ **Arka planda sürekli dinleme yok** — üsttekiyle bağlantılı; tepsi + arka plan modu birlikte gelecek.
- ⬜ **Yazıyla komut girişi yok** — bilinçli (ses öncelikli); klavye girişi alanı opsiyonel olarak eklenebilir.

## 6. Güvenlik ve veri
- ⬜ **İşlem günlüğü (audit) yok** — yapılan işlerin kalıcı kaydı tutulmuyor; “dün ne yaptın?” sorusu geçmişten cevaplanamaz. (Phase 4)
- ⬜ **Dosya yazmada yedek / geri al yok** — yanlış yazılan not geri alınamaz. (Phase 4)
- ⬜ **Ayarları dışa/içe aktarma yok.**

## 7. Platform / kurulum
- ⬜ **macOS hiç test edilmedi** — Windows için geliştirildi.
- ⬜ **Final kurulum dosyası henüz yok** — şu an kaynak koddan çalışıyor; NSIS kurulum ürün bitince üretilecek.
- ⬜ **Windows başlangıcında otomatik açılma yok.**
- ⬜ **Otomatik güncelleme yok.**

## 8. Altyapı
- ⬜ **Yedek sağlayıcı yok** — DeepSeek kesintisinde ikinci sağlayıcıya geçilmiyor (Groq adapter’ı ikincil olarak planlı).
- ⬜ **Maliyet/token sayaçları görünmüyor.**
- ⬜ **Çevrimdışı mod yok** — sistem TTS dışında beyin ve ses tanıma internet ister.

## 9. Kullanıcı incelemesinden gelenler
> İnceleme sırasında bildirdiğin eksikler buraya eklenir (tarihiyle).

- _(henüz yeni bildirim yok — sen söyledikçe buraya işlenecek)_

## ✅ Çözülenler
- _(henüz boş)_
