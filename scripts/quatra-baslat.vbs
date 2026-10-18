' Quatra kaynak kod baslaticisi — masaustu kisayolu bunu cagirir.
' Cift tikla -> arka planda dev ortami acilir (konsol penceresi yok).
' NOT (tepsi modu): Quatra penceresini X ile kapatsan bile surec ARKA PLANDA SURER
' (pencere tepsiye iner, V1-13); gercek cikis tepsi menusundendir. Bu yuzden
' asagidaki "zaten calisiyor" kontrolu vardir: ikinci baslatma yerine mevcut pencere kullanilir.

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

' Bu dosya <repo>\scripts\ icindedir; repo koku iki ust klasor.
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(scriptsDir)
sh.CurrentDirectory = repoRoot

If Not fso.FolderExists(repoRoot & "\node_modules") Then
  MsgBox "node_modules bulunamadi. Once klasorde 'npm install' calistir.", 48, "Quatra"
  WScript.Quit 1
End If

' Zaten calisiyor mu? Yalnizca BU repo'nun electron'i sayilir (QuatraElectronRunning):
' baska bir projenin electron.exe'si yanlis pozitif uretmesin diye surec adi yerine
' calistirilabilir dosya yolu repo koku altinda mi diye bakilir. (electron.exe komut
' satiri sadece "." tasidigi icin komut satiri ayrimi guvenilir degildir.)
If QuatraElectronRunning() Then
  MsgBox "Quatra zaten calisiyor - acik olan pencereyi kullanabilirsin.", 64, "Quatra"
  WScript.Quit 0
End If

' Gizli pencerede hata olusursa gorunmez kalmasin: stdout+stderr log dosyasina yazilir.
' Log: %LOCALAPPDATA%\Quatra\dev-electron.log (append; onceki kosunun hatasi da kalir).
logDir = fso.BuildPath(sh.ExpandEnvironmentStrings("%LOCALAPPDATA%"), "Quatra")
If Not fso.FolderExists(logDir) Then
  fso.CreateFolder(logDir)
End If
logFile = fso.BuildPath(logDir, "dev-electron.log")

' 0 = tamamen gizli pencere; surec arka planda surer, GUI penceresi gorunur.
cmd = "cmd /c echo ---- %date% %time% ---- >> """ & logFile & """ && npm run dev:electron >> """ & logFile & """ 2>&1"
sh.Run cmd, 0, False

' Baslatma dogrulamasi: ~20 sn icinde bu repo'nun electron sureci gorunmezse
' kullaniciya log yolu ile uyari gosterilir (sessiz basarisizlik olmaz).
started = False
For i = 1 To 40
  WScript.Sleep 500
  If QuatraElectronRunning() Then
    started = True
    Exit For
  End If
Next

If Not started Then
  msg = "Quatra baslatilamadi (electron penceresi acilmadi)." & vbCrLf & vbCrLf
  msg = msg & "Log dosyasi: " & logFile & vbCrLf
  msg = msg & "Log dosyasini Notepad ile acip son satirlara bak."
  MsgBox msg, 48, "Quatra"
End If

' Yalnizca BU repo'nun electron surecini bulur: ExecutablePath, repo koku ile baslar
' (<repo>\node_modules\electron\dist\electron.exe). Baska projelerin electron'lari
' farkli yolda oldugu icin eslesmez.
Function QuatraElectronRunning()
  QuatraElectronRunning = False
  found = False
  On Error Resume Next
  Set wmi = GetObject("winmgmts:\\.\root\cimv2")
  If Err.Number = 0 Then
    Set procs = wmi.ExecQuery("SELECT ProcessId, ExecutablePath FROM Win32_Process WHERE Name='electron.exe'")
    If Err.Number = 0 Then
      For Each proc In procs
        exePath = "" & proc.ExecutablePath
        If Len(exePath) > 0 And InStr(1, exePath, repoRoot, vbTextCompare) > 0 Then
          found = True
          Exit For
        End If
      Next
    End If
  End If
  On Error Goto 0
  QuatraElectronRunning = found
End Function
