# Platform Matrisi — Quatra

> Amaç: "Windows + macOS destekler" iddiasını dürüst tutmak.
> Bu makinede yalnızca **Windows** doğrulanabilir; macOS satırları **unverified** etiketlidir.

## Doğrulama durumu

| Özellik | Windows (bu makinede doğrulanır) | macOS (doğrulanmadı — kod yolu planlı) |
|---|---|---|
| Uygulama açılışı | ✅ doğrulandı | ⬜ unverified (darwin dalları hazır: pencere/activate) |
| Mikrofon izni (getUserMedia) | ✅ doğrulandı (canlı seviye + kayıt) | ⬜ unverified (TCC izni; DMG'de `NSMicrophoneUsageDescription` tanımlı) |
| Ses tanıma (Groq Whisper — ağ) | ✅ doğrulandı | ⬜ unverified (platformdan bağımsız; ağ ister) |
| Konuşma (Edge Neural TTS — ağ) | ✅ doğrulandı | ⬜ unverified (platformdan bağımsız; sistem TTS'e düşer) |
| Başlangıçta çalıştır (autostart) | ✅ Electron `app.setLoginItemSettings` | ⬜ unverified (mac: Login Items; kod darwin destekli) |
| Tepsi (tray) | ✅ planlı | ⬜ unverified (menü çubuğu simgesi hazır: `tray.png` + `@2x`) |
| Global kısayol | ✅ Electron `globalShortcut` | ⬜ unverified (Accessibility izni gerekebilir) |
| Sistem ses seviyesi | ⚠️ V1: destek yok — "unsupported" işaretli | ⚠️ aynı |
| Dosya yolları | `%APPDATA%\Quatra` | `~/Library/Application Support/Quatra` (`app.getPath` ile) |
| Paketleme | NSIS (onaya bağlı — SORULAR #6) | dmg (`npm run package:mac`; yalnız macOS'ta üretilir) |

## Yaygın tuzaklar
- Windows'ta ses cihazı seçimi Web Audio'da sınırlıdır → çıkış cihazı seçimi "desteklenmiyor" olarak dürüstçe işaretlenir.
- macOS'ta mikrofon ve Accessibility izinleri ilk kullanımda sistem diyalogları ile istenir; ret edilirse uygulama `muted` durumda kalır ve recovery yolu sunar.
- Global kısayol çakışmaları (başka uygulamayla) ayarlarda "kaydedilemedi" hatası ile gösterilir.

## İlk sürüm politika
- Doğrulanamayan her özellik UI'da **"unsupported (macOS)"** veya **"unverified"** etiketi taşır.
- Sahte "çalışıyor" göstergesi yasaktır.
