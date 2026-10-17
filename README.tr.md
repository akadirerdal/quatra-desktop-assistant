# Quatra — Ses Öncelikli Masaüstü Asistanı

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-6e5fc4)
![durum](https://img.shields.io/badge/durum-v0.1.0%20kaynak%20%C3%B6nizleme-6e5fc4)
![ses](https://img.shields.io/badge/ses-T%C3%BCrk%C3%A7e-6e5fc4)

[English](README.md) · **Türkçe**

**Quatra, Windows ve macOS için modüler, ses-öncelikli bir masaüstü asistanıdır.** Sen konuşursun, o yapar: **“Quatra”** dersin, **“Efendim?”** duyarsın, komutunu söylersin — yanıtı sesli alırsın. Sürekli sohbet edebilir, sözünü kesmene izin verir ve bilgisayarındaki araçları gerçek, uygulanan izinlerle kullanır.

Electron + Vite + React + TypeScript ile geliştirilir. Beyin: **DeepSeek** · Kulaklar: **Groq Whisper** · Ses: **Edge Neural TTS** (ulaşılamazsa sistem sesine düşer).

> Bu proje “sahte arayüz yok” kuralıyla geliştirilir: çalışmayan hiçbir şey çalışıyor gibi gösterilmez; bu README’de yazılan her şey gerçekten çalışır.

## Neler yapar

**🎙 Ses**

- Uyandırma kelimesi **“Quatra”** (*kuatra/quatro* gibi telaffuzlar da tanınır) → **“Efendim?”** → komutun.
- **Sürekli sohbet** (varsayılan açık): yanıt bitince kendiliğinden dinlemeye döner — tekrar “Quatra” demene gerek kalmaz; sessiz kalırsan beklemeye geçer (varsayılan 5 sn, ayarlanabilir).
- **Bas-konuş** (global): Windows’ta `Ctrl+Shift+Space` · macOS’te `⌘⇧Space` — Ayarlar’dan değiştirilebilir.
- **Barge-in:** Quatra konuşurken sözünü kesersen anında susar ve dinler.
- **Sesli durdurma:** “sus” / “dur” / “yeter” de — sohbet bitmeden susar.
- **Uyku:** “uyu” de — sohbet biter, mikrofon açık kalır, uyandırma kelimesi bekler.
- Doğal Türkçe sesler (Emel/Ahmet, Edge Neural); Edge’e ulaşılamazsa sistem sesine otomatik düşer.

**🧠 Zeka**

- DeepSeek (`deepseek-chat` / `deepseek-reasoner`); gerçek model listesi sağlayıcıdan çekilir ve doğrulanır — uydurma liste yok.
- Beş **model seviyesi** (Düşük → Ultra Max) ve iki çalışma modu (**Hızlı** / **Düşünceli**) — alt çubuktan ya da sesle (“yazılım moduna geç”) geçilir.
- **Yedek sağlayıcı:** DeepSeek geçici olarak hata verirse Groq otomatik devralır; ikisi de düşerse dürüst sesli hata alırsın.

**🛠 Araçlar (gerçek, izinli)**

- `sysinfo`, `open_app` (katı allowlist), `open_url` (yalnız http/https), `not_al` (seçtiğin klasöre markdown not), `clipboard_yaz`, `clipboard_oku`.
- Üç izin seviyesi: **safe / low-risk / sensitive**. Hassas işlemler **sözlü onay** ister (“evet” / “hayır”, 20 sn zaman aşımı) — ekranda onay kutusu yok. Model kendi iznini genişletemez; kabuk (shell) erişimi yoktur.

**🧷 Hafıza**

- Varsayılan yerel (`memory.json`): “hatırla: …” sessizce kaydeder; “adım ne?” yanıtlar; işine yarayan kişisel bilgiler konuşmadan öğrenilir (sessiz öğrenme — kapatılabilir).
- Yönetim: Ayarlar → **Hafıza** (liste, sil, temizle) — silmeden önce yedek alınır.
- İsteğe bağlı **mem0** bulut motoru (anahtar kasada); varsayılan motor yereldir.

**🖥 Masaüstü**

- Tepsi modu: pencereyi kapatınca Quatra tepsiye iner, çalışmaya devam eder; çıkış tepsi menüsünden (macOS: ⌘Q).
- Windows açılışında başlat (kurulu sürümlerde; kaynak modda dürüstçe “desteklenmez” işaretlidir).
- 7 tema, arayüz ölçeği, hareketi azaltma.
- İşlem kaydı (“İşlem Kaydı”), not yedeği + tek tıkla geri alma, token sayaçları, teşhis, ayar dışa/içe aktarma (API anahtarları dahil edilmez).
- Pencere: Windows’ta özel başlık çubuğu; macOS’te yerel trafik ışıkları + uygulama menüsü. İlk açılışta tam ekran (F11 / ⌃⌘F).

## Nasıl çalışır

```
Mikrofon → seviye/VAD → “Quatra” uyandırma → Groq Whisper (STT) → DeepSeek + araçlar → Edge Neural TTS → Hoparlör
```

Ses yalnız canlı yazıya çevrilir — diske asla yazılmaz.

## Hızlı başlangıç (kaynaktan)

> Kurulum dosyası henüz yayınlanmadı — bilerek. Ürün, paketleme onayı alana kadar kaynaktan çalıştırılır (bkz. [Paketleme](#paketleme)).

**Gereksinimler:** Node.js ≥ 22 (Windows 10/11 veya macOS), internet (beyin ve kulaklar bulut servisleri) ve iki ücretsiz API anahtarı (aşağıda).

```bash
git clone https://github.com/akadirerdal/quatra-desktop-assistant.git
cd quatra-desktop-assistant
npm install
npm run dev:electron
```

### İlk kurulum

1. Uygulama **“Quatra’yı kur”** davetiyle açılır.
2. **Ayarlar → AI Sağlayıcı**:
   - **DeepSeek API anahtarı**nı yapıştır (platform.deepseek.com → API keys) — beyin.
   - **Groq API anahtarı**nı yapıştır (console.groq.com → API keys) — ses tanıma ve uyandırma kelimesi (ücretsiz kota yeterli).
   - Anahtarlar işletim sistemi şifreli kasasında saklanır (Windows DPAPI / macOS Keychain) — dosyaya açık yazılmaz, arayüze asla dönmez.
3. **Test et** — gerçek bir istek atılır; “bağlı” yalnız gerçekten bağlanınca yanar. **Modelleri getir** gerçek model listesini çeker.
4. İstendiğinde **mikrofon izni** ver (macOS: sistem diyaloğu; Windows: Ayarlar → Gizlilik → Mikrofon).
5. **“Quatra”** de ya da `Ctrl+Shift+Space` / `⌘⇧Space` bas.

### macOS notları

- Aynı komutlar: `npm install` → `npm run dev:electron`.
- Mikrofon izni ilk kullanımda sorulur; reddedilirse: Sistem Ayarları → Gizlilik ve Güvenlik → Mikrofon (geliştirmede **Electron**, paketli sürümde **Quatra** görünür).
- Bas-konuş varsayılanı **⌘⇧Space**; çakışma olursa Ayarlar’dan bildirilir ve değiştirilir.
- Veriler `~/Library/Application Support/Quatra` altında tutulur.
- `open_app` eşlemesi: TextEdit · Calculator · Finder · Terminal · Activity Monitor (Paint’in macOS karşılığı yok — uydurmak yerine dürüst hata döner).
- macOS uyarlaması kodda tamam; gerçek Mac doğrulaması sürüyor — bkz. [docs/platform-matrix.md](docs/platform-matrix.md).
- DMG yalnız macOS’ta üretilir: `npm run package:mac`.

### Paketleme

```bash
npm run package:win   # Windows NSIS kurulumu → release/   (henüz yayınlanmadı)
npm run package:mac   # macOS DMG → release/              (yalnız macOS; henüz yayınlanmadı)
```

Kurulum dosyaları yalnız ürün onaylanınca üretilip paylaşılır. O zamana kadar kaynaktan çalıştırılır.

## Kullanım

**“Quatra”** de → “Efendim?” → komutunu söyle. Aktif sohbette uyandırma kelimesi gerekmez; sessizlik beklemeye alır.

| Söyle | Ne olur |
|---|---|
| “Quatra, not defterini aç” | Not Defteri (Windows) / TextEdit (macOS) açılır |
| “Hesap makinesini aç” | Hesap Makinesi / Calculator |
| “Görev yöneticisini aç” | Görev Yöneticisi / Activity Monitor |
| “10 dakika sonra çayı hatırlat” | Yerel hatırlatıcı (2 sn – 24 saat); zamanı gelince sesli haber verir |
| “hatırla: yarın sınavım var” | Yerel hafızaya sessizce kaydeder |
| “adım ne?” | Hafızadan yanıtlar |
| “yazılım moduna geç” / “normal moda geç” | Çalışma modunu değiştirir (Pro / Hızlı) |
| “detaylı anlat” | Kısa yanıt yerine uzun yanıt ister |
| “sus” | Anında susar |
| “uyu” | Sohbeti bitirir — mikrofon açık kalır |
| “bilgisayar bilgisi ver” | `sysinfo` aracı çalışır |
| “github.com’u aç” | Adresi varsayılan tarayıcıda açar (yalnız http/https) |

Hassas işlemler (pano okuma, not dosyası yazma) önce sözlü “evet/hayır” onayı ister.

## Yapılandırma

Ayarlar dokuz bölümden oluşur:

| Bölüm | İçinde ne var |
|---|---|
| **Genel** | Açılış / otomatik başlatma, ayarları dışa & içe aktarma (anahtarlar hariç), sürüm |
| **AI Sağlayıcı** | DeepSeek ve Groq anahtarları, gerçek bağlantı testi, model listesi |
| **Ses ve Giriş** | Canlı seviyeli mikrofon testi, giriş cihazı, VAD hassasiyeti, yakalama filtreleri, TTS ses/hız/perde |
| **Etkinleştirme** | Bas-konuş kısayolu, uyandırma kelimesi ve sürekli sohbet anahtarları |
| **Görünüm** | 7 tema, vurgu rengi, arayüz ölçeği, hareketi azaltma |
| **Hafıza** | Hafıza listesi ve yönetimi, motor (yerel / mem0), otomatik öğrenme |
| **Gizlilik** | Konuşma metinleri (varsayılan kapalı) ve silme |
| **İşlem Kaydı** | Quatra’nın yaptıklarının kaydı — görüntüle & temizle |
| **Teşhis** | Günlükler, token kullanımı, sürüm bilgisi |

**Model seviyeleri** (alt çubuktaki model pill’inden):

| Seviye | Model | Sıcaklık | Token |
|---|---|---|---|
| Düşük | deepseek-chat | 0.3 | 1024 |
| Varsayılan | deepseek-chat | 0.7 | 2048 |
| Yüksek | deepseek-reasoner | 0.7 | 4096 |
| Max | deepseek-reasoner | 1.0 | 8192 |
| Ultra Max | deepseek-reasoner | 1.2 | 8192 |

## Araçlar ve izinler

| Araç | Seviye | Ne yapar |
|---|---|---|
| `sysinfo` | safe | İşletim sistemi & uygulama bilgisi |
| `open_app` | low-risk | Yalnız izinli listedeki uygulamayı açar: not defteri, hesap makinesi, dosya gezgini, komut istemi / PowerShell, görev yöneticisi, Paint (Windows); TextEdit, Calculator, Finder, Terminal, Activity Monitor (macOS) |
| `open_url` | low-risk | http/https bağlantısını varsayılan tarayıcıda açar |
| `not_al` | low-risk + onay | Seçtiğin klasöre markdown not yazar (klasör hatırlanır; var olan not üzerine yazılmadan önce yedeklenir) |
| `clipboard_yaz` | low-risk | Metni panoya kopyalar |
| `clipboard_oku` | sensitive + onay | Panodaki metni okur |

İzinler native katmanda uygulanır — model kendi kendine izin veremez.

## Hafıza ve gizlilik

**Verilerin yeri:**

| Windows | macOS |
|---|---|
| `%APPDATA%\Quatra` | `~/Library/Application Support/Quatra` |

| Dosya | İçerik |
|---|---|
| `credentials.json` | API anahtarları — işletim sistemi kasasıyla şifreli (DPAPI / Keychain); yalnız ana süreç okuyabilir |
| `settings.json` (+ `.bak`) | Ayarlar; atomik yazım, bozulmada yedekten kurtarma |
| `memory.json` (+ `.bak`) | Yerel hafıza kayıtları; silmeler yedeklenir |
| `logs/quatra.log` | Döngüsel günlük (~1 MB rotasyon); sırlar redact’lanır |
| `audit.jsonl` | İşlem kaydı — son 800 girdi, redact’lı |
| `transcripts.jsonl` | Konuşma metinleri — **yalnız sen açarsan**; silinebilir |
| `token-usage.json` | Token sayaçları (aylık + toplam) |
| `notes-dir.txt` | Seçtiğin not klasörü |

**Makineden dışarı ne çıkar:** komut metnin Groq’a (yazıya çevirme) ve DeepSeek’e (yanıt) gider; yanıt metni seslendirme için Microsoft Edge TTS uç noktasına gider. Ses kaydı saklanmaz. İsteğe bağlı mem0 motorunu açarsan hafıza oraya eşitlenir — aksi halde her şey yerelde kalır. API anahtarları makineden ayrılmaz.

## Geliştirme

```bash
npm install           # bağımlılıkları kur
npm run dev           # yalnız arayüz (tarayıcıda)
npm run dev:electron  # tam uygulama, canlı yenileme (önerilen)
npm run test          # 241 birim testi — gerçek API anahtarı gerekmez
npm run verify        # typecheck + lint + test + secret taraması (kapı)
npm run build         # üretim derlemesi (dist + dist-electron)
npm run check:secrets # secret taraması (verify içinde de koşar)
npm run format        # Prettier
```

**Proje haritası:**

| Alan | Yer |
|---|---|
| Electron ana süreç — pencere, tepsi, kısayollar, IPC, kasa, işlem kaydı | `electron/` |
| Ses hattı — yakalama, seviye, VAD, kayıt, barge-in, TTS kuyruğu | `src/features/audio/` |
| Uyandırma kelimesi | `src/features/audio/wake-word.ts` |
| Asistan akışı — uyandır → yanıtla → yeniden dinle | `src/features/assistant/assistant-controller.ts` |
| Agent döngüsü, akış, bağlam | `src/features/agent/` |
| Araçlar ve izinler | `src/features/tools/` |
| Sağlayıcılar — DeepSeek istemcisi, Groq transkripsiyon | `src/providers/` |
| Hafıza deposu ve çıkarımı | `src/services/memory/` |
| Ayar şeması (zod) ve store’lar (zustand) | `src/state/` |
| Arayüz — ana ekran, ayarlar, başlık çubuğu | `src/features/`, `src/renderer/` |
| Testler (vitest) | `tests/` |

Windows kolaylığı: `scripts/quatra-baslat.vbs` geliştirme uygulamasını gizli çalıştırır (masaüstü kısayolu dostu).

## Proje durumu

- **v0.1.0 — kaynak önizleme.** Windows, gerçek donanımda geliştirildi ve doğrulandı. macOS uyarlaması kodda tamam; cihaz üzerinde doğrulama sürüyor — platform iddiaları [docs/platform-matrix.md](docs/platform-matrix.md) dosyasında dürüstçe izlenir.
- **Sırada:** “Ses Stüdyosu” mikrofon yenilemesi — gerçek DSP zinciri, S1–S8, plan [MIKROFON.md](MIKROFON.md) dosyasında. Ardından: tarayıcı ve masaüstü ajan fazları ([TODO.md](TODO.md)).
- **Paketleme kapılı:** NSIS / DMG kurulum dosyaları yalnız ürün onaylanınca üretilir.

## Bilinen sınırlar (dürüst liste)

- Arayüz ve ses Türkçe; henüz İngilizce arayüz yok.
- Uyandırma kelimesi Groq üzerinden çalışır — internet ister. Tamamen yerel (çevrimdışı) uyandırma motoru planlıdır.
- Sistem ses seviyesi ve çıkış cihazı seçimi yok — uygulama bunları “desteklenmiyor” olarak işaretler, taklit etmez.
- Edge Neural TTS internet ister; çevrimdışıyken sistem sesine düşer.
- Linux test edilmedi; hedef Windows ve macOS.
- Otomatik güncelleme yok. Paketli derlemeler imzasız → paketleme başlayınca işletim sistemi güvenlik uyarısı çıkabilir.
- Mikrofon yakalama zinciri adım adım yeniden yazılıyor (mevcut zincir çalışıyor; stüdyo yükseltmesi sürüyor).

## Sorun giderme

| Sorun | Bak |
|---|---|
| Quatra sesimi duymuyor | Mikrofon düğmesinin durumu; Ayarlar → Ses ve Giriş → canlı seviye testi; sistem mikrofon izni |
| Uyandırma kelimesi çalışmıyor | Groq anahtarı girili mi? “Quatra” kelimesini net söyle; Ayarlar → Etkinleştirme’ye bak |
| Ses çıkışı yok | Edge TTS internet ister; çevrimdışıysa sistem sesi devralır — Windows’ta ek sesler: Ayarlar → Saat ve Dil → Konuşma → Sesleri ekle |
| Pencere kapandı ama uygulama açık | Tepsi modudur — tepsi simgesinden göster; çıkış için tepsi menüsü |
| Sağlayıcı hataları | Ayarlar → AI Sağlayıcı → **Test et** / **Modelleri getir** gerçek hatayı gösterir |
| Günlükler nerede? | Ayarlar → Teşhis ya da `%APPDATA%\Quatra\logs\quatra.log` (macOS: `~/Library/Application Support/Quatra`) |

## Belgeler

- 📘 [Kullanım kılavuzu (PDF)](docs/Quatra-Kullanim-Kilavuzu.pdf)
- 🗺 [Platform matrisi](docs/platform-matrix.md) — ne, nerede doğrulandı
- 🎛 [MIKROFON.md](MIKROFON.md) — mikrofon stüdyo planı (S1–S8)
- 🗓 [TODO.md](TODO.md) — yol haritası ve geliştirme geçmişi (tek plan kaynağı)
- ❓ [SORULAR.md](SORULAR.md) — açık sorular
- 🧩 [EKSIKLER.md](EKSIKLER.md) — bilinen eksikler
- 📦 [V1-UPDATE.md](V1-UPDATE.md) — v1 geri bildirim listesi

## Lisans

Henüz lisans seçilmedi — şimdilik tüm hakları saklıdır. Fikir ve geri bildirim için GitHub Issues’a bekleriz.
