#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================="
echo "  Solar Hub - Coletor Cooperalianca (Concessionaria)"
echo "======================================================="

if [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
elif [ -f ".venv/bin/python3" ]; then
    PYTHON_BIN=".venv/bin/python3"
else
    PYTHON_BIN="python3"
fi

$PYTHON_BIN collector_utility.py --pdf
