@echo off
title Sistema Gestion de Notas - LAN
color 0A

echo ========================================================
echo       SISTEMA DE GESTION DE NOTAS - MODO UNIFICADO
echo ========================================================
echo.

:: Asegurar que estamos en la carpeta correcta
cd /d "%~dp0"

:: Cerrar procesos anteriores para evitar conflictos de puerto
echo Limpiando procesos antiguos...
taskkill /f /im node.exe >nul 2>&1

echo Iniciando servidor en puerto 8080...
echo (Este proceso debe permanecer abierto)
echo.

:: Iniciar el servidor en una nueva ventana minimizada o en esta misma
:: Lo iniciaremos en esta misma para que el usuario vea si hay errores críticos
start "Servidor Gestion de Notas" /min node server.js

:: Esperar a que el servidor levante
timeout /t 3 > nul

:: Abrir el navegador
echo Abriendo interfaz del sistema...
start http://localhost:8080

echo.
echo ========================================================
echo EL SISTEMA ESTA LISTO.
echo Puede acceder desde otros dispositivos en la red local.
echo ========================================================
echo.
timeout /t 5
exit
