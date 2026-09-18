@echo off
cd /d "%~dp0"
title Solar Hub - Coletor Cooperalianca (Concessionaria)
echo =======================================================
echo   Sincronizando Faturas e Creditos GD Cooperalianca
echo =======================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" collector_utility.py --pdf
) else (
    python collector_utility.py --pdf
)
echo.
pause
