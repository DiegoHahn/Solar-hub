@echo off
cd /d "%~dp0"
title Solar Hub - Coletor de Inversores (Tempo Real 24/7)

:loop
echo =======================================================
echo   Iniciando Coletor Solar dos 3 Inversores
echo   API REST Local em: http://localhost:5000/api/latest
echo =======================================================

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" collector_inverters.py
) else (
    python collector_inverters.py
)

echo.
echo [!] O processo do coletor encerrou em %date% as %time%.
echo [!] Reiniciando automaticamente em 5 segundos... (Pressione Ctrl+C para cancelar)
timeout /t 5 >nul
goto loop
