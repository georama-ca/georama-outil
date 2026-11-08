' Georama Production depuis le Hub Georama : ouvre l'interface (http://127.0.0.1:8765),
' en lancant le programme en arriere-plan s'il ne tourne pas deja. Installe par « Installer le bouton du hub.cmd ».
Option Explicit
Dim sh, fso, dossier, py, adresse, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dossier = fso.GetParentFolderName(WScript.ScriptFullName)
adresse = "http://127.0.0.1:8765/"
If Not Repond(adresse & "api/infos") Then
  py = dossier & "\.venv\Scripts\pythonw.exe"
  If Not fso.FileExists(py) Then
    MsgBox "Georama Production n'est pas encore installé sur cet ordinateur." & vbCrLf & "Lance d'abord Installer.bat dans le dossier georama-production.", 48, "Georama Production"
    WScript.Quit 1
  End If
  sh.CurrentDirectory = dossier
  sh.Environment("PROCESS")("PYTHONUTF8") = "1"
  sh.Run """" & py & """ """ & dossier & "\serveur.py"" --sans-navigateur", 0, False
  For i = 1 To 60
    WScript.Sleep 500
    If Repond(adresse & "api/infos") Then Exit For
  Next
  If Not Repond(adresse & "api/infos") Then
    MsgBox "Georama Production n'a pas démarré." & vbCrLf & "Double-clique sur « Georama Production.bat » pour voir le message d'erreur.", 48, "Georama Production"
    WScript.Quit 1
  End If
End If
sh.Run adresse

Function Repond(url)
  On Error Resume Next
  Dim x
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1000, 1000, 2000, 2000
  x.Open "GET", url, False
  x.Send
  Repond = (Err.Number = 0)
  If Repond Then Repond = (x.Status = 200)
  Err.Clear
End Function
