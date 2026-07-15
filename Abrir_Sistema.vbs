Set WshShell = CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' Verificar si el servidor ya está corriendo
strQuery = "Select * from Win32_Process Where Name = 'node.exe' AND CommandLine Like '%server.js%'"
Set colProcesses = objWMIService.ExecQuery(strQuery)

If colProcesses.Count = 0 Then
    ' Si no está corriendo, iniciarlo en segundo plano
    WshShell.CurrentDirectory = "c:\programacion\sistema_lovable\gestionnotes-main"
    WshShell.Run "node server.js", 0, False
    ' Esperar un segundo para que el servidor levante
    Wscript.Sleep 1000
End If

' Abrir el navegador
WshShell.Run "http://localhost:8080"
