' Quatra kaynak kod baslaticisi — masaustu kisayolu bunu cagirir.
' Cift tikla -> arka planda dev ortami acilir (konsol penceresi yok).
' Quatra penceresini kapatinca tum surecler (vite/electron) kendiliginden durur.

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

' Zaten calisiyor mu? (electron sureci varsa ikinci pencere acma)
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='electron.exe'")
If Err.Number = 0 Then
  If procs.Count > 0 Then
    MsgBox "Quatra zaten calisiyor - acik olan pencereyi kullanabilirsin.", 64, "Quatra"
    WScript.Quit 0
  End If
End If
On Error Goto 0

' 0 = tamamen gizli pencere; surec arka planda surer, GUI penceresi gorunur.
sh.Run "cmd /c npm run dev:electron", 0, False
