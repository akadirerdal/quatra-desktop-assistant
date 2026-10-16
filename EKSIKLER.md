# Quatra — Eksikler Listesi

> Bu dosya iki kaynaktan beslenir: **(1)** kullanıcının inceleme sırasında bildirdiği eksikler, **(2)** geliştirme tarafında bilinen ve dürüstçe belgelenmiş sınırlar.
> Her geliştirme turunda güncellenir; bir madde çözülünce ilgili yerden çıkarılıp ✅ bölümüne taşınır.
> Son güncelleme: 16.10.2026 · Durum işaretleri: ⬜ açık · 🟡 kısmen var · ✅ çözüldü

---

## İlk sürüm (v1) için öncelik önerisi — geliştirici görüşü (16.10.2026)

Kullanıcının sorusu üzerine: bence v1’den önce çözülmesi gerekenler, önem sırasıyla:

1. **Konuşma bağlamı** — takip soruları (“peki ya yarın?”) şu an anlaşılmıyor; asistanı “insan gibi” hissettiren en kritik parça. (Phase 3)
2. **Hatırlatıcı / zamanlayıcı** — “10 dakika sonra hatırlat” yok; asistanın en çok beklenen yeteneği, yokluğu hemen fark ediliyor.
3. **Yanıt akışı + “sus” komutu** — uzun cevapta ilk ses gecikmesi büyük; sesli durdurma komutu yok. Sesli deneyimde “kontrol” hissi için şart.
4. **Uyandırma kelimesinin yerelleşmesi** — “Quatra” demek bile internet turu; internet yokken asistan tümüyle sağır. Yerel uyandırma modeli gecikmeyi ve bağımlılığı bitirir.
5. **Yedek sağlayıcı + zarif hata** — DeepSeek kesintisinde Quatra sessiz kalıyor; “şu an bağlanamıyorum” diyebilmeli ve ikinci sağlayıcıya geçebilmeli.
6. **Tepsi + arka plan + otomatik başlatma** — asistan “her an orada” olmalı; kullanıcı da otomatik başlatma istedi (bkz. §9).
7. **Kurulum dosyası + otomatik güncelleme** — v1’in dağıtılabilir olması için; şu an yalnız kaynak koddan çalışıyor.
8. **İşlem günlüğü + dosya yedeği/geri alma** — yaptığı işlerin kaydı ve yanlış yazımda geri dönüş; güven için.
9. **Maliyet/token görünürlüğü** — küçük ama şeffaflık sağlar.

_Bu sıralama §9’daki kullanıcı maddeleriyle birleştirilip **`V1-UPDATE.md`** olarak ayrı listeye alındı — v1 kapsamının tek doğru kaynağı artık V1-UPDATE.md’dir._

---

## 1. Sesli deneyim
- ⬜ **Uyandırma kelimesi buluta bağlı** — “Quatra” tespiti bile Groq Whisper’a gidip gelir; internet yokken uyandırma çalışmaz. (Çözüm yolu: yerel küçük uyandırma modeli.)
- ⬜ **Yanıtlar canlı akıtılmıyor** — cevabın tamamı üretilmeden seslendirme başlamaz; uzun yanıtta ilk ses gecikmesi büyür. (Cümle cümle akış planlı.)
- ⬜ **“Sus / kes sesini” komutu yok** — Quatra ancak üstüne konuşunca susar (barge-in); açık bir durdurma komutu eklenebilir.
- ⬜ **Sistem ses seviyesi / medya kontrolü yok** — “sesi kıs”, “şarkı değiştir” desteklenmiyor.
- ⬜ **Yalnızca Türkçe** — başka dilde konuşma/arayüz yok.
- ⬜ **Mikrofon cihazı seçimi yok** — sistemde birden fazla mikrofon olsa da uygulama varsayılanı kullanıyor (geliştirici önerisi, 16.10).

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
> İnceleme sırasında bildirdiğin eksikler buraya tarihiyle işlenir; çözülenler ✅ bölümüne taşınır.
> **Not:** Tur 7’deki tüm maddeler v1 planına alındı → bkz. `V1-UPDATE.md`.

### Tur 7 — 16.10.2026 (kullanıcı bildirimleri — “şimdilik sadece not et”)

1. ⬜ **Mikrofon ayarları artırılsın + mikrofon testi gelsin** — “konuş, seviyeyi gör, ayarla” akışı: canlı seviye göstergesi ve test kaydıyla kullanıcı kendine göre ayar yapabilsin.
2. ⬜ **Kademeli ayarlar** — kazanç ve gürültü engelleme gibi seçenekler yalnız açık/kapalı değil, seviyeli olsun (ör. zayıf/orta/güçlü). *Teknik not:* tarayıcı filtreleri temelde açık/kapalı; kademe, yazılım katmanıyla (kazanç düğümü + eşikli gürültü kapısı) sağlanabilir.
3. ⬜ **Mikrofon davranışı** — mikrofon fiziksel olarak hep açık kalsın (konuşsak da konuşmasak da); Quatra yalnız “Quatra” kelimesine tepki versin; mikrofon açık diye uykuya geçmeyi reddetmesin.
4. ⬜ **Uyku süresi ayarı** — kullanıcıdan X saniye ses gelmezse uykuya dönülsün (**varsayılan 5 sn**); bu süre Ayarlar’dan her kullanıcı kendine göre değiştirebilsin.
5. 🟡 **Daha fazla tema** — hazır renk temaları/paletler. _(Tur 9: tema motoru yazıldı; 7 hazır tema Ayarlar → Görünüm'den canlı deneniyor; ince ayar sende → V1-15)_
6. 🟡 **Mikrofon kapatma simgesi yenilenmeli** — mevcut MIC rozeti beğenilmedi. _(Tur 9: C · Ekolayzır seçildi, uygulandı ve beğenildi; asıl kastedilen ortadaki kırmızı çapraz çizgi (muted görseli) kaldırıldı → V1-16)_
7. ⬜ **Windows açılışında otomatik başlatma** — bilgisayar kapanıp açıldığında Quatra kendiliğinden başlasın; Ayarlar’dan aç/kapat edilebilsin.
8. ⬜ **İzin istekleri sözlü olsun** — izin gerektiğinde ekranda baloncuk/görev kartı çıkmasın; Quatra sözlü sorsun (ör. “Not alayım mı?”) ve sesli “evet/hayır” ile onay alsın.

_(Yeni bildirim geldikçe buraya eklenir.)_

## ✅ Çözülenler
- ✅ **(Tur 9, 16.10) Ölü görünüm kontrolleri gerçek oldu** — vurgu rengi artık tüm arayüze uygulanıyor (eskiden yalnızca visualizer çizimine gidiyordu); "Arayüz ölçeği" ve "Hareketi azalt" artık gerçekten etkili; tema altyapısı eklendi (7 tema) → V1-15.
