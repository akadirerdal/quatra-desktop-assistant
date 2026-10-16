# -*- coding: utf-8 -*-
"""
Quatra Kullanım Kılavuzu üreticisi — reportlab ile tek komut:
    python scripts/quatra-kilavuz.py
Çıktı: docs/Quatra-Kullanim-Kilavuzu.pdf
Türkçe karakterler için Windows Arial (TrueType) kullanılır; gömülür.
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (HRFlowable, KeepTogether, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

FONTS = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Arial", os.path.join(FONTS, "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(FONTS, "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", os.path.join(FONTS, "ariali.ttf")))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", os.path.join(FONTS, "arialbi.ttf")))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold",
                              italic="Arial-Italic", boldItalic="Arial-BoldItalic")

ACCENT = colors.HexColor("#6E5FC4")
ACCENT_LIGHT = colors.HexColor("#EDEAF9")
TEXT = colors.HexColor("#23232B")
MUTED = colors.HexColor("#6B6B76")

S_TITLE = ParagraphStyle("t", fontName="Arial-Bold", fontSize=26, leading=31, textColor=TEXT)
S_SUB = ParagraphStyle("s", fontName="Arial", fontSize=11.5, leading=16, textColor=MUTED)
S_H1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=16, leading=20, textColor=ACCENT,
                      spaceBefore=14, spaceAfter=6)
S_H2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=12.5, leading=16, textColor=TEXT,
                      spaceBefore=10, spaceAfter=4)
S_P = ParagraphStyle("p", fontName="Arial", fontSize=10.5, leading=15, textColor=TEXT, spaceAfter=5)
S_B = ParagraphStyle("b", fontName="Arial", fontSize=10.5, leading=15, textColor=TEXT,
                     leftIndent=14, bulletIndent=4, spaceAfter=2)
S_CELL = ParagraphStyle("c", fontName="Arial", fontSize=9.6, leading=13, textColor=TEXT)
S_CELLB = ParagraphStyle("cb", fontName="Arial-Bold", fontSize=9.6, leading=13, textColor=TEXT)
S_NOTE = ParagraphStyle("n", fontName="Arial-Italic", fontSize=9.6, leading=13.5, textColor=MUTED,
                        spaceAfter=4)


def P(t, style=S_P):
    return Paragraph(t, style)


def B(items):
    return [Paragraph(f"•&nbsp;&nbsp;{t}", S_B) for t in items]


def table(rows, widths, header=True):
    data = []
    for r_i, row in enumerate(rows):
        data.append([Paragraph(c, S_CELLB if (header and r_i == 0) else S_CELL) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D8D4EC")),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT))
    t.setStyle(TableStyle(style))
    return t


def footer(canv, doc):
    canv.saveState()
    canv.setFont("Arial", 8)
    canv.setFillColor(MUTED)
    canv.drawString(2 * cm, 1.1 * cm, "Quatra Kullanım Kılavuzu · v0.1.0 · 16 Ekim 2026")
    canv.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Sayfa {doc.page}")
    canv.setStrokeColor(colors.HexColor("#E3E0F2"))
    canv.setLineWidth(0.5)
    canv.line(2 * cm, 1.45 * cm, A4[0] - 2 * cm, 1.45 * cm)
    canv.restoreState()


def build():
    story = []

    # ------------------------------------------------------------ kapak başlığı
    story.append(P("Quatra", S_TITLE))
    story.append(P("Sesli masaüstü asistanı — Kullanım Kılavuzu", S_SUB))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceAfter=10))
    story.append(P("Bu kılavuz, 16 Ekim 2026 itibarıyla geliştirme sürümünü (v0.1.0) anlatır. "
                   "Şu an uygulama, masaüstündeki <b>Quatra</b> kısayolundan kaynak koddan başlatılır; "
                   "kurulum dosyası ürün tamamlanınca hazırlanacaktır.", S_P))

    # ------------------------------------------------------------ 1. Nedir
    story.append(P("1. Quatra nedir?", S_H1))
    story.append(P("Sen konuşursun; Quatra duyar, düşünür ve sesli yanıt verir. "
                   "Klavye gerekmez. İnternetteki yapay zekâ (DeepSeek) beynidir; "
                   "sesini yazıya çevirme (Groq Whisper) ve doğal Türkçe konuşma (Edge Neural) "
                   "ağ üzerinden çalışır. Bilgisayarında yaptığı işler (uygulama açma, not alma, "
                   "pano, hafıza) yerel araçlarla ve senin onayınla yürütülür.", S_P))

    # ------------------------------------------------------------ 2. Başlatma
    story.append(P("2. Başlatma ve kapatma", S_H1))
    for b in B([
        "Masaüstündeki <b>Quatra</b> kısayoluna çift tıkla → uygulama tam ekran açılır.",
        "Kapatmak için sağ üstteki <b>kapat</b> düğmesi yeterlidir; arka planda çalışan tüm parçalar da kendiliğinden durur.",
        "Uygulama açıkken kısayola yeniden tıklarsan ikinci pencere açılmaz; “zaten çalışıyor” uyarısı gösterilir.",
        "Yeni bir sürüm denemek istersen: pencereyi kapat, kısayola tekrar tıkla. Kısayol her zaman güncel kodu başlatır.",
    ]):
        story.append(b)

    # ------------------------------------------------------------ 3. Ekran
    story.append(P("3. Ekranı tanı", S_H1))
    story.append(table([
        ["Bölge", "Ne işe yarar"],
        ["Üst şerit", "Solda QUATRA adı; sağda pencere düğmeleri (küçült · büyüt/tam ekran · kapat). F11 de tam ekranı değiştirir."],
        ["Ortadaki animasyon", "Durumu gösteren visualizer: <b>Hazır</b>, <b>Dinliyor</b>, <b>Düşünüyor</b>, <b>Konuşuyor</b>."],
        ["Durum yazısı ve ipucu", "“Uyandırmak için «quatra» de” gibi yönlendirmeler."],
        ["Yazı balonu (altyazı)", "Söylediğin söz ve Quatra'nın son cevabı; birkaç saniye sonra solar."],
        ["Görev balonları", "Not alma gibi işler sırasında beliren saydam kartlar: Çalışıyor → Tamamlandı / Başarısız."],
        ["Sol alt MIC rozeti", "Mikrofonu elle aç/kapat. Kapalıyken Quatra hiçbir şey duymaz."],
        ["Sağ üst dişli", "Ayarlar panelini açar."],
        ["Alt çubuk (iki seçici)", "Solda <b>DeepSeek model seviyesi</b> (Düşük…Ultra Max), sağda <b>çalışma modu</b> (Hızlı / Düşünceli). Tıkla, seç; seçim anında uygulanır."],
    ], [4.2 * cm, 12.6 * cm]))

    # ------------------------------------------------------------ 4. Sesli kullanım
    story.append(P("4. Sesli kullanım (ana akış)", S_H1))
    story.append(P("Standart akış:", S_H2))
    for b in B([
        "“<b>Quatra</b>” de → “Efendim?” diye karşılar ve komutunu bekler.",
        "Komutunu söyle: “saat kaç?” · “not defterini aç” · “hatırla: yarın sınavım var”.",
    ]):
        story.append(b)
    story.append(P("Tek nefeste komut: “Quatra, not defterini aç” — Quatra uyandırma kelimesini duyduğu anda kalan sözü komut olarak alır.", S_NOTE))
    story.append(P("Sürekli sohbet (varsayılan açık)", S_H2))
    story.append(P("Cevap bitince mikrofon kendiliğinden dinlemeye döner; her seferinde “Quatra” demen gerekmez. "
                   "Uzun süre sessiz kalırsan sohbet beklemeye geçer — yeniden “Quatra” dersin.", S_P))
    story.append(P("Sözünü kesme (barge-in, varsayılan açık)", S_H2))
    story.append(P("Quatra konuşurken sen konuşmaya başlarsan çalma anında durur ve seni dinlemeye geçer "
                   "(GPT ses modu gibi). Ayarlardan kapatılabilir.", S_P))
    story.append(P("Bas-konuş ve elle kontrol", S_H2))
    for b in B([
        "<b>Ctrl+Shift+Space</b> — basılı tut, konuş, bırak. Kısayol <b>globaldir</b>: uygulama arka plandayken de çalışır.",
        "Kısayol tuşu Ayarlar → Etkinleştirme bölümünden değiştirilebilir.",
        "Elle: sol alttaki <b>MIC</b> rozetine tıklayarak mikrofonu aç/kapat.",
        "Etkinleştirme biçimi üçtan biridir: Elle (butonla) · Bas-konuş (kısayol) · Uyandırma kelimesi. Uyandırma için Groq anahtarı gerekir.",
    ]):
        story.append(b)

    # ------------------------------------------------------------ 5. Yetenekler
    story.append(PageBreak())
    story.append(P("5. Şu an gerçekten çalışan yetenekler", S_H1))
    story.append(table([
        ["Yetenek", "Nasıl kullanılır / notlar"],
        ["Sohbet ve soru-cevap", "Her konuda soru sor; cevaplar kısa tutulur. “detaylı anlat / uzun anlat” dersen kapsamlı yanıt verir."],
        ["Sistem bilgisi", "“sistemin nasıl?” → sürüm, işletim sistemi bilgisi döner."],
        ["Uygulama açma", "“not defterini aç” · “hesap makinesini aç”. İzinli liste: not defteri, hesap makinesi, dosya gezgini, komut istemi, PowerShell, Paint, Görev Yöneticisi. Türkçe adlar tanınır."],
        ["Web adresi açma", "“youtube'u aç” → varsayılan tarayıcıda açar. Yalnızca http/https adresleri."],
        ["Not alma", "“masaüstüne toplantı notu al: …” → Markdown (.md) dosyası yazar; klasör seçtirir ve onay ister."],
        ["Panoya kopyalama", "“bunu panoya kopyala: …” → panoya yazar."],
        ["Pano okuma", "Yalnızca Ayarlar → Gizlilik'te “Pano okumaya izin ver” açıksa; her kullanımda onay ister."],
        ["Hafıza", "6. bölüme bak — kendiliğinden öğrenme + elle komutlar."],
        ["Mod komutları", "“yazılım moduna geç” (derin model) · “normal moda geç” · “mod değiştir”."],
    ], [4.2 * cm, 12.6 * cm]))
    story.append(Spacer(1, 6))
    story.append(P("Model seviyeleri (alt çubuktaki sol seçici)", S_H2))
    story.append(table([
        ["Seviye", "Model", "Ne zaman kullanılır"],
        ["Düşük", "deepseek-chat", "En hızlı ve tutumlu — kısa sorular"],
        ["Varsayılan", "deepseek-chat", "Günlük kullanım dengesi"],
        ["Yüksek", "deepseek-reasoner", "Derin düşünme — kod ve analiz"],
        ["Max", "deepseek-reasoner", "En yüksek kalite, uzun cevaplar"],
        ["Ultra Max", "deepseek-reasoner", "Sınırları zorla — en yaratıcı"],
    ], [2.6 * cm, 4.4 * cm, 9.8 * cm]))

    # ------------------------------------------------------------ 6. Hafıza
    story.append(P("6. Hafıza — nasıl çalışır?", S_H1))
    story.append(P("Quatra, seninle konuşurken <b>kalıcı değer taşıyan</b> bilgileri kendiliğinden öğrenir: "
                   "isim, yaş, kalıcı tercihler, ilişkiler, önemli tarihler (ör. “kedimin adı Boncuk”). "
                   "Günlük konuşmalar, sorular ve geçici durumlar kaydedilmez. Öğrenme <b>sessizdir</b>; "
                   "Quatra “hatırladım” demez, sohbete doğal biçimde devam eder.", S_P))
    story.append(P("Elle komutlar", S_H2))
    for b in B([
        "“benim adım Ayşe” · “soyadım Yılmaz” → isim bilgisi kaydedilir.",
        "“hatırla: yarın toplantım var” · “not et: süt al” · “unutma: annemin doğum günü 5 Mayıs” → kaydedilir.",
        "“adım ne?” → ismini hafızadan söyler. “neler hatırlıyorsun?” → son kayıtları listeler.",
    ]):
        story.append(b)
    story.append(P("Yönetim — Ayarlar → Hafıza", S_H2))
    for b in B([
        "<b>Hafızayı sohbette kullan</b>: kayıtlar cevap üretilirken dikkate alınır.",
        "<b>Konuşmalardan otomatik öğren</b>: kapatırsan yalnızca elle verdiğin kayıtlar tutulur.",
        "<b>Hafıza motoru</b>: <b>Yerel</b> (varsayılan — veri cihazında kalır) veya <b>mem0</b> (GitHub'daki popüler hafıza katmanının bulut sürümü; app.mem0.ai anahtarı gerekir). mem0 seçilse bile yerel kopya her zaman tutulur.",
        "Listede tüm kayıtları görürsün; tek tek silebilir, yenisini ekleyebilir, tümünü temizleyebilirsin.",
    ]):
        story.append(b)

    # ------------------------------------------------------------ 7. Ayarlar
    story.append(PageBreak())
    story.append(P("7. Ayarlar rehberi (sağ üst dişli)", S_H1))
    story.append(table([
        ["Bölüm", "İçindekiler"],
        ["Genel", "Asistan adı, kişilik/talimat (“nasıl davransın?”), dil (Türkçe), sürüm bilgisi."],
        ["AI Sağlayıcı", "DeepSeek API anahtarı (şifreli kasada), Groq API anahtarı (ses tanıma için), sohbet ve yazılım modelleri, yaratıcılık, azami token, zaman aşımı, “Test et” düğmesi."],
        ["Ses ve Giriş", "Cevapları sesli oku, konuşma hızı, ses seçimi (doğal Türkçe sesler) ve ses testi; ses tanıma motoru; konuşma motoru (Edge Neural / Windows); sürekli sohbet; barge-in; mikrofon filtreleri (gürültü azaltma, yankı önleme, otomatik kazanç); mikrofon hassasiyeti 1–10."],
        ["Etkinleştirme", "Etkinleştirme biçimi (Elle / Bas-konuş / Uyandırma kelimesi), bas-konuş kısayolu, uyandırma kelimesi."],
        ["Görünüm", "Vurgu rengi, görsel yoğunluk, animasyon hızı, ışıltı, arayüz ölçeği, hareketi azalt."],
        ["Hafıza", "6. bölüme bak (anahtarlar, motor seçimi, kayıt listesi)."],
        ["Gizlilik", "Konuşma metinlerini sakla (varsayılan kapalı), pano okumaya izin ver (varsayılan kapalı)."],
        ["Teşhis", "Mikrofon ve sağlayıcı durumu, seçili model, araçlar, son hatalar; günlük dosyasını aç/temizle, konuşma bağlamını temizle, varsayılanlara dön."],
    ], [3.4 * cm, 13.4 * cm]))

    # ------------------------------------------------------------ 8. Veri ve gizlilik
    story.append(P("8. Veriler ve gizlilik — ne nerede?", S_H1))
    story.append(table([
        ["Yerleşim", "İçerik"],
        ["%APPDATA%\\Quatra\\credentials.json", "API anahtarları — Windows şifre kasasıyla şifreli; ekranda bir daha gösterilmez."],
        ["%APPDATA%\\Quatra\\settings.json", "Tüm ayarların (şifresiz veriler)."],
        ["%APPDATA%\\Quatra\\memory.json", "Hafıza kayıtları — yalnızca bu cihazda; hafızada tuttuğun isim, tercih ve notlar; istediğinde tek tek veya tümüyle silebilirsin."],
        ["%APPDATA%\\Quatra\\logs\\quatra.log", "Çalışma günlüğü — sorun teşhisi için; sırlar otomatik gizlenir, 1 MB'da döner."],
    ], [6.4 * cm, 10.4 * cm]))
    story.append(P("Dışarıya giden tek şeyler: soruların DeepSeek'e (yanıt üretimi), ses kaydın Groq'a (yazıya çevirme), "
                   "okunacak cevap metni Microsoft Edge sesine (seslendirme) gider. Anahtarlar ve hafıza cihazında kalır. "
                   "mem0 motorunu seçersen, hafıza olguları ek olarak mem0 bulutuna da yazılır (yerel kopya korunur).", S_NOTE))

    # ------------------------------------------------------------ 9. Sorun giderme
    story.append(P("9. Sorun giderme", S_H1))
    story.append(table([
        ["Belirti", "Çözüm"],
        ["Sesim algılanmıyor", "Ayarlar → Ses ve Giriş → Mikrofon hassasiyetini yükselt (1'e doğru). Filtrelerin açık olduğundan emin ol."],
        ["Kendiliğinden tetikleniyor", "Hassasiyeti azalt (10'a doğru); mikrofonu gürültülü ortamdan uzaklaştır."],
        ["Mikrofon izni hatası", "Windows Ayarlar → Gizlilik ve güvenlik → Mikrofon → masaüstü uygulamalarına izin ver."],
        ["Yanıt gelmiyor", "İnternet bağlantısını kontrol et; Teşhis → sağlayıcı durumu; AI Sağlayıcı → “Test et”."],
        ["Uyandırma kelimesi çalışmıyor", "Groq anahtarı gerekir (AI Sağlayıcı). Ses tanıma motoru “Kapalı” olmasın."],
        ["Quatra hiç duymuyor", "Sol alttaki MIC rozeti kapalı olabilir; tıklayıp aç."],
        ["Sorun sürüyor", "Teşhis → “Günlük dosyasını aç” → en alttaki kayıtlara bak; geliştiriciyle paylaş."],
    ], [4.4 * cm, 12.4 * cm]))

    # ------------------------------------------------------------ 10. Sınırlar
    story.append(P("10. Bilinen sınırlar (dürüst liste)", S_H1))
    for b in B([
        "Sistem ses seviyesini değiştirme veya medya oynatma/kontrol etme henüz yok.",
        "Yalnızca Windows üzerinde geliştirildi ve test edildi; macOS denenmedi.",
        "Tepsi (system tray) simgesi ve Windows başlangıcında otomatik açılma henüz yok.",
        "Yanıt, cümle cümle canlı akıtılmaz; oluşturulup bir bütün olarak konuşulur (kısa cevap varsayılanı bunu dengeler).",
        "Uygulama açma, yalnızca izinli 7 uygulamayla sınırlıdır; keyfi program çalıştırılmaz.",
        "Bu liste, sonraki geliştirme adımlarında eritilecek; kılavuz her sürümde güncellenir.",
    ]):
        story.append(b)

    # ------------------------------------------------------------ 11. Hızlı kart
    story.append(P("11. Hızlı komut kartı", S_H1))
    story.append(table([
        ["Ne yapmak istiyorsun?", "Söyle / yap"],
        ["Quatra'yı uyandır", "“Quatra”"],
        ["Tek nefeste sor", "“Quatra, hava nasıl?”"],
        ["Bas-konuş", "Ctrl+Shift+Space (basılı tut, konuş, bırak)"],
        ["İsmini söyle", "“benim adım …” · “soyadım …”"],
        ["Bir şey hatırlat", "“hatırla: …” · “not et: …” · “unutma: …”"],
        ["Hafızadan sor", "“adım ne?” · “neler hatırlıyorsun?”"],
        ["Uygulama aç", "“not defterini aç” · “hesap makinesini aç”"],
        ["Web aç", "“youtube'u aç”"],
        ["Not al (dosya)", "“masaüstüne toplantı notu al: …”"],
        ["Uzun cevap iste", "“detaylı anlat” · “uzun anlat”"],
        ["Derin modele geç", "“yazılım moduna geç”"],
        ["Tam ekran", "F11"],
    ], [5.2 * cm, 11.6 * cm], header=True))

    # ------------------------------------------------------------ Ek: kod haritası
    story.append(PageBreak())
    story.append(P("Ek: Teknik meraklısına kod haritası", S_H1))
    story.append(P("“Neyin nerede çalıştığını” koda inerek görmek istersen:", S_NOTE))
    story.append(table([
        ["Parça", "Dosya / klasör"],
        ["Pencere, kısayollar, veri yolu, günlük", "electron/main.ts"],
        ["Ses hattı (mikrofon, kayıt, barge-in, TTS)", "src/features/audio/audio-service.ts"],
        ["Uyandırma kelimesi ve komut devri", "src/features/audio/wake-word.ts"],
        ["Asistan akışı (uyandırma → yanıt → dinleme)", "src/features/assistant/assistant-controller.ts"],
        ["Yerel komutlar (hatırla, adım ne, mod)", "src/features/assistant/commands.ts"],
        ["Ajan döngüsü + sistem talimatı", "src/features/agent/loop.ts"],
        ["Araçlar (uygulama aç, not al, pano…)", "src/features/tools/"],
        ["Hafıza deposu ve çıkarım kuralları", "src/services/memory/"],
        ["Ayarlar şeması (varsayılanlar)", "src/state/settings-schema.ts"],
        ["Ayarlar arayüzü (8 bölüm)", "src/features/settings/SettingsPanel.tsx"],
        ["DeepSeek istemcisi", "src/providers/deepseek/client.ts"],
        ["Groq Whisper (ses → yazı)", "src/providers/groq/transcribe.ts"],
        ["masaüstü kısayolu + gizli başlatıcı", "scripts/quatra-baslat.vbs"],
        ["Bu kılavuzun üreticisi", "scripts/quatra-kilavuz.py"],
    ], [7.0 * cm, 9.8 * cm]))

    doc = SimpleDocTemplate(
        "docs/Quatra-Kullanim-Kilavuzu.pdf",
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title="Quatra Kullanım Kılavuzu", author="Quatra", subject="v0.1.0 kullanım kılavuzu",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print("docs/Quatra-Kullanim-Kilavuzu.pdf yazıldı")


if __name__ == "__main__":
    os.makedirs("docs", exist_ok=True)
    build()
