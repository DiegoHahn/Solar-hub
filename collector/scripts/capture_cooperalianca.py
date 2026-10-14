#!/usr/bin/env python3
"""Script for capturing and structurally anonymizing Cooperaliança utility API responses.

Executed exclusively on the Orange Pi edge device (or machine connected with valid .env).
Saves real anonymized responses to collector/tests/fixtures/cooperalianca/*.json.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

# Makes the collector package importable from a plain checkout (no `pip install -e .` needed)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from collector.utility import (
    API_BASE,
    ENV,
    UCS,
    login_cooperalianca,
    portal_headers,
    safe_api_get,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "cooperalianca"

SENSITIVE_RULES = [
    (
        re.compile(r"^(cpf|cpfcnpj|inscricao|documento)$", re.IGNORECASE),
        lambda idx: "000.000.000-00",
    ),
    (
        re.compile(r"(^|_)(datanascimento|nascimento)$", re.IGNORECASE),
        lambda idx: "01/01/1970 00:00:00",
    ),
    (re.compile(r"(telefone|celular|fone)$", re.IGNORECASE), lambda idx: "(00) 00000-0000"),
    (
        re.compile(r"^(titular|nometitular|nomeusuario)$", re.IGNORECASE),
        lambda idx: "Titular Teste",
    ),
    (
        re.compile(r"^(endereco|logradouro)$", re.IGNORECASE),
        lambda idx: f"Rua Teste, {(idx + 1) * 100}",
    ),
    (re.compile(r"^email$", re.IGNORECASE), lambda idx: f"teste{idx + 1}@solarhub.local"),
    (re.compile(r"ssid$", re.IGNORECASE), lambda idx: f"WIFI-TESTE-{idx + 1}"),
    (re.compile(r"mac$", re.IGNORECASE), lambda idx: f"02:00:00:00:00:{idx + 1:02d}"),
    (re.compile(r"(^|_)(sn|serial)$", re.IGNORECASE), lambda idx: f"SN-{idx + 1}"),
    (
        re.compile(
            r"^(codigouc|codigoucant|codigoconsumidor|codigofatura|codigo_uc)$", re.IGNORECASE
        ),
        lambda idx: str(90001 + idx),
    ),
    (re.compile(r"(^|_)ip$", re.IGNORECASE), lambda idx: f"10.0.0.{idx + 1}"),
]

MIN_SENSITIVE_LENGTH = 4


def collect_sensitive_values(node, found, counters):
    if isinstance(node, list):
        for item in node:
            collect_sensitive_values(item, found, counters)
        return
    if not isinstance(node, dict):
        return

    for key, val in node.items():
        if isinstance(val, (dict, list)):
            collect_sensitive_values(val, found, counters)
            continue
        text = str(val or "").strip()
        if len(text) < MIN_SENSITIVE_LENGTH or text in found:
            continue

        for rule_idx, (pattern, gen_fn) in enumerate(SENSITIVE_RULES):
            if pattern.search(key):
                placeholder = gen_fn(counters[rule_idx])
                counters[rule_idx] += 1
                unaccented = "".join(
                    c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
                )
                digits = re.sub(r"\D", "", text)
                variants = [text, text.upper(), unaccented, unaccented.upper()]
                if len(digits) >= 11:
                    variants.append(digits)
                for variant in variants:
                    if variant not in found:
                        found[variant] = placeholder
                break


def anonymize(data):
    found = {}
    counters = [0] * len(SENSITIVE_RULES)
    collect_sensitive_values(data, found, counters)

    json_str = json.dumps(data, indent=2, ensure_ascii=False)
    for orig, placeholder in sorted(found.items(), key=lambda x: len(x[0]), reverse=True):
        escaped = re.escape(orig)
        json_str = re.sub(rf"(?<![\w.-]){escaped}(?![\w-])", placeholder, json_str)

    json_str = re.sub(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", "000.000.000-00", json_str)
    json_str = re.sub(r"(?<![\d.])\d{11}(?![\d.])", "00000000000", json_str)
    json_str = re.sub(r"\b192\.168\.\d+\.\d+\b", "10.0.0.1", json_str)
    return json_str


def save_fixture(filename, data):
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = FIXTURES_DIR / filename
    clean_json = anonymize(data)
    out_path.write_text(clean_json + "\n", encoding="utf-8")
    print(f"  Saved and anonymized: {out_path.relative_to(Path.cwd())}")


def main():
    cpf = ENV.get("COOPERALIANCA_CPF")
    senha = ENV.get("COOPERALIANCA_SENHA")

    if not cpf or not senha or not UCS:
        print("COOPERALIANCA_CPF, COOPERALIANCA_SENHA or COOPERALIANCA_UCS missing in .env")
        sys.exit(1)

    headers = portal_headers()
    print("Connecting to Cooperaliança portal...")
    auth = login_cooperalianca(cpf, senha, headers)
    if not auth:
        print("Authentication failed.")
        sys.exit(1)

    headers["Authorization"] = f"Bearer {auth['Token']}"
    save_fixture("Auth.json", {**auth, "Token": "TOKEN-JWT-TESTE-VALIDO"})

    uc_principal = UCS[0]
    print(f"Capturing endpoints for consumer unit (UC) {uc_principal}...")

    perfil = safe_api_get(
        f"{API_BASE}PerfilUsuario/BuscarPerfilUsuario?codigoUc={uc_principal}", headers, default={}
    )
    save_fixture("BuscarPerfilUsuario.json", perfil)

    faturas = safe_api_get(
        f"{API_BASE}Fatura/RecuperarHistoricoFaturaConsumo60Meses?codigoUc={uc_principal}",
        headers,
        default=[],
    )
    save_fixture("RecuperarHistoricoFaturaConsumo60Meses.json", faturas)

    resumo = safe_api_get(
        f"{API_BASE}ImprimirFaturas/RecuperarResumoUltimaFaturaUc?codigoUc={uc_principal}",
        headers,
        default={},
    )
    save_fixture("RecuperarResumoUltimaFaturaUc.json", resumo)

    dados_gd = safe_api_get(
        f"{API_BASE}GeracaoDistribuida/RecuperarDadosGeracaoDistribuida?codigoUc={uc_principal}",
        headers,
        default={},
    )
    save_fixture("RecuperarDadosGeracaoDistribuida.json", dados_gd)

    hist_gd = safe_api_get(
        f"{API_BASE}GeracaoDistribuida/RecuperarDadosHistoricoGeracao?codigoUc={uc_principal}",
        headers,
        default={},
    )
    save_fixture("RecuperarDadosHistoricoGeracao.json", hist_gd)

    consumo_gd = safe_api_get(
        f"{API_BASE}GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo?codigoUc={uc_principal}",
        headers,
        default={},
    )
    save_fixture("BuscaDadosHistoricoGeracaoConsumo.json", consumo_gd)

    print("\nAll responses captured and anonymized successfully!")


if __name__ == "__main__":
    main()
