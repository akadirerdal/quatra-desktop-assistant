# Quatra — Sana Sorulacaklar

> Kullanıcı talimatı (16.10.2026): *"tüm notları ve eksikleri bitirene kadar devam et; bana soracaklarını da not et; en son konuşuruz."*
> Bu dosya biriken kararları/soruları tutar. Geliştirme durmaz; yanıtlar gelince buraya işlenir.

## Cevaplanacaklar

1. **Hafıza temizliği kasıtlı mıydı?** — 16.10 sabahı `memory.json` sessizce boşaltılmış bulundu (kodda tek sessiz yol: Ayarlar → Hafıza'daki ✕ / "Tümünü sil"). Bildiğim kayıtları **geri yükledim**: kişisel kayıtlar (ayrıntılar yalnızca cihazdaki hafızada) · "efendim" hitabı. *Kasıtlı sildiysen söyle, yeniden temizlerim.* Ayrıca artık silmeden önce otomatik yedek alınıyor (`memory.json.bak`) + silme olayları log'a düşüyor.

2. **Tema favorileri (V1-15)** — 7 temadan hangileri kalsın, hangileri çıksın? Şafak (aydınlık) temanın kontrast turunu ben geçirdim; kalmasını istersen kalır.

3. **Uyku süresi** — varsayılan **5 sn** yapıldı (senin notun). Ayarlar → Ses ve Giriş'ten değiştirilebilir. Bulduğun değer farklıysa söyle.

4. **Mikrofon testi (V1-01)** — Ayarlar → Ses ve Giriş'te canlı seviye + kaydet/dinle. Akış yeterli mi, yoksa daha detaylı mı olsun?

5. **Yerel uyandırma (V1-08)** — durum en son netleşecek. Yerel model (native modül) ağır bir bağımlılık; internetli çalışan mevcut sistem + net durum rozeti şimdilik duruyor.

6. **Kurulum + güncelleme (V1-20/V1-21)** — kural "NSIS ürün bitince". Liste bitince kurulum dosyasını üretelim mi? Otomatik güncelleme gerçek bir dağıtım sunucusu ister; sunucu planın yoksa "manuel güncelleme" dürüst seçeneğinde kalırız.

7. **"Sus" komutu (V1-07)** — uygulandı; varsayılan kelimeler: "sus / sussana / sus bakalım / sus artık / artık sus / kes sesini / sesini kes / sessiz ol / konuşma / dur / yeter / yeter artık". Senin kullanacağın kelimeler farklıysa söyle.

8. **Hatırlatıcı sesi (V1-11)** — uygulandı; şimdilik **yalnız sesli** ("Efendim, hatırlatmam var: …") + görsel balon. İstersen kısa bir zil sesi de ekleyebilirim — söyle.

9. **Tepsi davranışı (V1-13)** — pencere kapatılınca arka planda dinlemeye devam etsin mi, yoksa "kapalı sayıl" (yalnız tepside beklesin, sen açınca dinlesin) mi? Varsayılanı uyguluyorum: tepside yaşar + dinleme **kapalı** başlar, tek tıkla açılır (gizlilik tarafı güvenli olan).

10. **İzin istekleri (V1-09)** — sözlü onay "evet/hayır" ile çalışıyor; **20 sn** cevap gelmezse işlem yapılmaz (güvenli varsayılan). İki kez anlaşılmayan yanıtta da güvenli ret. Süre sence uygun mu?

> Not: Bu dosyaya geliştirme sırasında yeni sorular eklenir; **hiçbir soru geliştirmeyi durdurmaz** — makul varsayımla ilerlerim, varsayım burada listelenir.
