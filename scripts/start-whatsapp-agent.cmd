@echo off
setlocal

set "PROJECT_PATH=D:\Hopital-Punta-Lara"
set "NPM_PATH=C:\Program Files\nodejs\npm.cmd"
set "LOG_DIRECTORY=D:\Hospital-WhatsApp\logs"
set "LOG_PATH=%LOG_DIRECTORY%\whatsapp-agent.log"
set "WHATSAPP_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"

if not exist "%LOG_DIRECTORY%" mkdir "%LOG_DIRECTORY%"
cd /d "%PROJECT_PATH%"

:restart
echo.>> "%LOG_PATH%"
echo [%date% %time%] Iniciando agente de WhatsApp>> "%LOG_PATH%"

call "%NPM_PATH%" run whatsapp:agent >> "%LOG_PATH%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] El agente termino con codigo %EXIT_CODE%. Reintentando en 15 segundos.>> "%LOG_PATH%"
timeout /t 15 /nobreak >nul
goto restart
