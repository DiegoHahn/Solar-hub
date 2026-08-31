@echo off
title Solar Hub - Coletor Cooperalinca (Concessionaria)
echo =======================================================
echo   Sincronizando Faturas e Creditos GD Cooperalinca
echo =======================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" collector_utility.py --pdf
) else (
    python collector_utility.py --pdf
)
pause
