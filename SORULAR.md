# Quatra — Sana Sorulacaklar

> Kullanıcı talimatı (16.10.2026): *"tüm notları ve eksikleri bitirene kadar devam et; bana soracaklarını da not et; en son konuşuruz."*
> Bu dosya biriken kararları/soruları tutar. Geliştirme durmaz; yanıtlar gelince buraya işlenir.

## Cevaplanacaklar

1. **Hafıza temizliği kasıtlı mıydı?** — 16.10 sabahı `memory.json` sessizce boşaltılmış bulundu (kodda tek sessiz yol: Ayarlar → Hafıza'daki ✕ / "Tümünü sil"). Bildiğim kayıtları **geri yükledim**: kişisel kayıtlar (ayrıntılar yalnızca cihazdaki hafızada) · "efendim" hitabı. *Kasıtlı sildiysen söyle, yeniden temizlerim.* Ayrıca artık silmeden önce otomatik yedek alınıyor (`memory.json.bak`) + silme olayları log'a düşüyor.

2. **Tema favorileri (V1-15)** — 7 temadan hangileri kalsın, hangileri çıksın? Şafak (aydınlık) temanın kontrast turunu ben geçirdim; kalmasını istersen kalır.

3. **Uyku süresi** — varsayılan **5 sn** yapıldı (senin notun). Ayarlar → Ses ve Giriş'ten değiştirilebilir. Bulduğun değer farklıysa söyle.

4. **Mikrofon testi (V1-01)** — Ayarlar → Ses ve Giriş'te canlı seviye + kaydet/dinle. Akış yeterli mi, yoksa daha detaylı mı olsun?

5. **Yerel uyandırma (V1-08)** — durum en son netleşecek. Yerel model (native modül) ağır bir bağımlılık; internetli çalışan mevcut sistem + net durum rozeti şimdilik duruyor.

6. **Kurulum + güncelleme (V1-20/V1-21)** — kural "NSIS ürün bitince". Liste bitince kurulum dosyasını üretelim mi? Otomatik güncelleme gerçek bir dağıtım sunucusu ister; sunucu planın yoksa "manuel güncelleme" dürüst seçeneğinde kalırız. *(16.10: V1-14 otomatik başlatma uygulandı — yalnız kurulu/paketli sürümde etkin; kurulum dosyası hâlâ "ürün bitince" planında.)*

7. **"Sus" komutu (V1-07)** — uygulandı; varsayılan kelimeler: "sus / sussana / sus bakalım / sus artık / artık sus / kes sesini / sesini kes / sessiz ol / konuşma / dur / yeter / yeter artık". Senin kullanacağın kelimeler farklıysa söyle.

8. **Hatırlatıcı sesi (V1-11)** — uygulandı; şimdilik **yalnız sesli** ("Efendim, hatırlatmam var: …") + görsel balon. İstersen kısa bir zil sesi de ekleyebilirim — söyle.

9. **Tepsi davranışı (V1-13)** — uygulandı: pencere kapatılınca uygulama tepsiye iniyor ve yaşamaya devam ediyor. Dinleme durumu **kendiliğinden değişmiyor** (sen açtıysan açık kalır, kapalıysa kapalı); tepsi menüsünden "Mikrofonu Aç/Kapat" ile de yönetilebilir. "Kapalı sayıl" (tepside beklerken hep sessiz) istersen söyle — tek satırlık değişiklik.

10. **İzin istekleri (V1-09)** — sözlü onay "evet/hayır" ile çalışıyor; **20 sn** cevap gelmezse işlem yapılmaz (güvenli varsayılan). İki kez anlaşılmayan yanıtta da güvenli ret. Süre sence uygun mu?

11. **Ses Stüdyosu nerede yaşasın? (yeni mikrofon sistemi)** — Plan: Ayarlar'a yeni **"Ses Stüdyosu"** bölümü (Cihazlar · Mixer · Filtreler · Presetler · Teşhis alt bölümleriyle; mevcut karanlık tasarım dili). Alternatif: ayrı pencere. Önerim Ayarlar içinde — her şey tek yerde kalır. *(Ayrıntı: `MIKROFON.md`)*

12. **Varsayılan ses profili** — Yeni filtre zincirinde ilk açılışta ne aktif olsun: (a) **boş** — yalnız dahili temizlik, en öngörülebilir *(önerim)*; (b) "Hafif temizlik" — HPF + yumuşak bastırma; (c) "Konuşma netliği" — kompresör + EQ + bastırma. Üçü de hazır profil olarak tek tıkla denenebilecek.

13. **RNNoise güçlendirmesi** — Dahili gürültü bastırmaya ek olarak **RNNoise** (yerel, ücretsiz, BSD-3 lisanslı) motorunu opsiyonel olarak ekleyeyim mi? Klavye/fan seslerinde daha güçlü temizlik + STT'ye daha temiz ses. Önerim: ekle.

14. **Kodu Mac'e taşıma** — "geliştirmeye Mac'ten devam edeceğim" dedin; repo şu an bu Windows makinesinde (GitHub'daki genel repo **~46 commit geride** — hiçbir şey gönderilmedi). Seçenekler: **(a)** klasörü olduğu gibi kopyala/ZIP (git geçmişi dahil; hiçbir şey yayınlanmaz — önerim), **(b)** GitHub'a gönder (önce kişisel bilgileri temizlerim ya da repo'yu private yaparsın), **(c)** başka yol söyle. Not: API anahtarları makineye bağlı şifreli kasada olduğu için Mac'te yeniden girilir; ayarlar "dışa aktar" ile taşınabilir. Cevap verince hazırlarım.

> Not: Bu dosyaya geliştirme sırasında yeni sorular eklenir; **hiçbir soru geliştirmeyi durdurmaz** — makul varsayımla ilerlerim, varsayım burada listelenir.

---

## Tur 10 kapanışı (16.10.2026)

- **V1-UPDATE listesi bitti:** A ✅ · B ✅ · C ✅ · D ✅ · E 🟡 (favori/eleme = senin turun) · F ✅ · ek paket ✅ (ayarları dışa/içe aktarma) · G 🟡 ("ürün bitince" kuralı — kurulum dosyasını **onayın gelince tek komutla** üretirim) · V1-08 yerel uyandırma paketleme aşamasına bırakıldı (#5).
- **Senin kararını bekleyenler:** #2 tema favorileri · #5 yerel uyandırma · #6 kurulum dosyası üretilsin mi (+ güncelleme yolu) · #8 hatırlatıcı zili · #9 tepsi "kapalı sayıl" modu · #10 izin süresi (20 sn).
- **Uygulamayı yeniden başlatmayı unutma:** Tepsi menüsü → **Çıkış** → masaüstü kısayolu. (Main süreç değişiklikleri — tepsi, işlem kaydı, token sayaçları — yeniden başlatınca etkin olur.)
- **Dene:** pencereyi kapat → tepsiye iner · "10 dakika sonra çayı hatırlat" · konuşurken "sus" · hassas işte "evet/hayır" onayı · Ayarlar → **İşlem Kaydı** (audit + token sayaçları + not yedeği "Geri al") · Gizlilik'te gerçek butonlar + konuşma kaydı anahtarı · Genel'de ayar dışa/içe aktarma + "Windows açılışında başlat" (kaynak modda dürüstçe "desteklenmez" der).
