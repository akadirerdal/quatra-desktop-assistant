# Platform Matrisi — Quatra

> Amaç: "Windows + macOS destekler" iddiasını dürüst tutmak.
> Geliştirme artık **macOS**'ta sürüyor; Windows satırları önceki Windows makinesinde doğrulandı,
> macOS satırları bu makinede doğrulanıyor — henüz doğrulanmayan macOS satırları **unverified** etiketlidir.
> 18.10.2026 (Tur 12): macOS uyarlaması kodda tamamlandı — trafik ışıklı pencere, uygulama menüsü,
> `open_app` eşlemesi, mikrofon izni akışı, şablon menü-çubuğu simgesi; uçtan uca doğrulama sürüyor.

## Doğrulama durumu

| Özellik                          | Windows (Windows makinesinde doğrulandı)                       | macOS (bu makinede — doğrulama sürüyor)                                                                            |
| -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Uygulama açılışı                 | ✅ doğrulandı                                                  | ⬜ unverified (yerel trafik ışıkları `hiddenInset`; Dock tıklaması gizli pencereyi geri getirir)                   |
| Uygulama menüsü                  | — (menü kaldırıldı; özel başlık çubuğu)                        | ⬜ unverified (appMenu/editMenu/viewMenu/windowMenu → ⌘C/⌘V, ⌘Q, ⌃⌘F)                                              |
| Mikrofon izni (getUserMedia)     | ✅ doğrulandı (canlı seviye + kayıt)                           | ⬜ unverified (`askForMediaAccess` TCC diyaloğu; DMG'de `NSMicrophoneUsageDescription` tanımlı)                    |
| Ses tanıma (Groq Whisper — ağ)   | ✅ doğrulandı                                                  | ⬜ unverified (platformdan bağımsız; ağ ister)                                                                     |
| Konuşma (Edge Neural TTS — ağ)   | ✅ doğrulandı                                                  | ⬜ unverified (platformdan bağımsız; sistem TTS'e düşer)                                                           |
| Başlangıçta çalıştır (autostart) | ✅ Electron `app.setLoginItemSettings`                         | ⬜ unverified (mac: Login Items; kod darwin destekli)                                                              |
| Tepsi (tray)                     | ✅ doğrulandı (`icon.ico`)                                     | ⬜ unverified (şablon simge: `trayTemplate.png`/`@2x` — sistem tema rengini kendisi seçer)                         |
| Global kısayol                   | ✅ `globalShortcut` (varsayılan Ctrl+Shift+Space)              | ⬜ unverified (varsayılan `CommandOrControl+Shift+Space` → ⌘⇧Space)                                                |
| Uygulama açma (`open_app`)       | ✅ allowlist (notepad, calc, …)                                | ⬜ unverified (eşleme: TextEdit · Calculator · Finder · Terminal · Activity Monitor; Paint'in macOS karşılığı yok) |
| Sistem ses seviyesi              | ⚠️ V1: destek yok — uygulamada böyle bir kontrol/etiket de yok | ⚠️ aynı                                                                                                            |
| Dosya yolları                    | `%APPDATA%\Quatra`                                             | `~/Library/Application Support/Quatra` (`app.getPath` ile)                                                         |
| Paketleme                        | NSIS (onaya bağlı — SORULAR #6)                                | dmg (`npm run package:mac`; yalnız macOS'ta üretilir)                                                              |

## Yaygın tuzaklar

- Windows'ta ses cihazı seçimi Web Audio'da sınırlıdır → çıkış cihazı seçimi henüz yok; uygulama çalışmayan bir kontrol göstermez (sahte arayüz yasağı).
- macOS'ta mikrofon izni sistem diyaloğuyla istenir; ret edilirse uygulama dürüst mesajla sessiz kalır ve Sistem Ayarları → Gizlilik yolunu gösterir. Geliştirme modunda izin listesinde uygulama **Electron** olarak görünebilir (paketli DMG'de **Quatra**).
- Global kısayol çakışmaları (başka uygulamayla) ayarlarda "kaydedilemedi" hatası ile gösterilir; macOS'te ⌘⇧Space çakışırsa Ayarlar → Etkinleştirme'den değiştirilir.
- macOS'te pencere kapatma (⌘W / kırmızı düğme) uygulamayı kapatmaz — menü çubuğuna (tepsiye) iner; gerçek çıkış: menü → Çıkış veya ⌘Q.
- Uyandırma kelimesi/barge-in kararı HAM seviyeyle verilir; kazanç/kapı kararı bu kaynağı değiştirmemelidir (16.10 ölü-mikrofon dersi).

## İlk sürüm politika

- Doğrulanmamış her iddia bu dosyada **"unverified"** olarak işaretlenir; UI'da çalışmayan özellik gösterilmez.
- Sahte "çalışıyor" göstergesi yasaktır.
