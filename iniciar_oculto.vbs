Set WshShell = CreateObject("WScript.Shell")
' Ejecuta el archivo bat de forma oculta (el parámetro 0 al final oculta la ventana)
WshShell.Run chr(34) & "c:\programacion\sistema_lovable\gestionnotes-main\iniciar_sistema.bat" & Chr(34), 0
Set WshShell = Nothing
