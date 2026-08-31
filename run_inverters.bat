@echo off
title Solar Hub - Coletor de Inversores (Tempo Real)
echo =======================================================
echo   Iniciando Coletor Solar dos 3 Inversores
echo   API REST Local em: http://localhost:5000/api/latest
echo =======================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" collector_inverters.py
) else (
    python collector_inverters.py
)
pause
