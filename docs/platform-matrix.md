# Platform Matrisi — Quatra

> Amaç: "Windows + macOS destekler" iddiasını dürüst tutmak.
> Bu makinede yalnızca **Windows** doğrulanabilir; macOS satırları **unverified** etiketlidir.

## Doğrulama durumu

| Özellik | Windows (bu makinede doğrulanır) | macOS (doğrulanmadı — kod yolu planlı) |
|---|---|---|
| Uygulama açılışı | ✅ planlı test | ⬜ unverified |
| Mikrofon izni (getUserMedia) | ✅ planlı test | ⬜ unverified (TCC izni gerekir) |
| Ses çalma (speechSynthesis) | ✅ planlı test | ⬜ unverified |
| Web Speech STT | ✅ planlı test | ⬜ unverified (Safari desteği değişken) |
| Başlangıçta çalıştır (autostart) | ✅ Electron `app.setLoginItemSettings` | ⬜ unverified (mac: Login Items) |
| Tepsi (tray) | ✅ planlı | ⬜ unverified (menu bar) |
| Global kısayol | ✅ Electron `globalShortcut` | ⬜ unverified (Accessibility izni gerekebilir) |
| Sistem ses seviyesi | ⚠️ V1: destek yok — "unsupported" işaretli | ⚠️ aynı |
| Dosya yolları | `%APPDATA%` | `~/Library/Application Support` (planlı) |
| Paketleme | NSIS (electron-builder) | dmg/zip (notarization maliyeti doc'lu) |

## Yaygın tuzaklar
- Windows'ta ses cihazı seçimi Web Audio'da sınırlıdır → çıkış cihazı seçimi "desteklenmiyor" olarak dürüstçe işaretlenir.
- macOS'ta mikrofon ve Accessibility izinleri ilk kullanımda sistem diyalogları ile istenir; ret edilirse uygulama `muted` durumda kalır ve recovery yolu sunar.
- Global kısayol çakışmaları (başka uygulamayla) ayarlarda "kaydedilemedi" hatası ile gösterilir.

## İlk sürüm politika
- Doğrulanamayan her özellik UI'da **"unsupported (macOS)"** veya **"unverified"** etiketi taşır.
- Sahte "çalışıyor" göstergesi yasaktır.
