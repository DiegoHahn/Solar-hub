#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================="
echo "  Solar Hub - Coletor dos 3 Inversores (Tempo Real 24/7)"
echo "  API REST Local em: http://localhost:5000/api/latest"
echo "======================================================="

if [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
elif [ -f ".venv/bin/python3" ]; then
    PYTHON_BIN=".venv/bin/python3"
else
    PYTHON_BIN="python3"
fi

while true; do
    $PYTHON_BIN collector_inverters.py
    echo ""
    echo "[!] Processo do coletor encerrou em $(date). Reiniciando em 5 segundos..."
    sleep 5
done
