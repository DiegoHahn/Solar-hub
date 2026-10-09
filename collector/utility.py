import json
import logging
import os
import sys
import time
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import requests

from common import atomic_write_json, configure_logging
from common import load_env as _load_env

logger = logging.getLogger("collector.utility")

# Ensures UTF-8 support in Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")


def load_env() -> dict[str, str]:
    return _load_env(ENV_FILE)


ENV = load_env()

API_BASE = "https://portal.cooperalianca.com.br/agenciavirtual3bff/api/"
TOKEN_EXTERNO = ENV.get("COOPERALIANCA_TOKEN_EXTERNO", "")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Consumer units owned by titular account; the first is the generating unit (where solar plant is installed)
UCS = [uc.strip() for uc in ENV.get("COOPERALIANCA_UCS", "").split(",") if uc.strip()]

# Delays (seconds) before each retry attempt to authenticate with utility portal
LOGIN_RETRY_DELAYS = (60, 300)


def push_utility_to_supabase(result: dict[str, Any]) -> bool:
    """Pushes Cooperaliança utility snapshot to Supabase; returns False if push fails."""
    supabase_url = ENV.get("SUPABASE_URL")
    service_key = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return True

    payload = {
        "updated_at": result.get("timestamp"),
        "distribuidora": result.get("distribuidora", "Cooperaliança (Içara/SC)"),
        "titular": result["titular"],
        "cpf": result["cpf"],
        "perfil_usuario": result.get("perfil_usuario", {}),
        "unidades_consumidoras": result.get("unidades_consumidoras", {}),
    }
    # Left out when the tariff could not be fetched, so the upsert keeps the last stored one
    if result.get("tarifa_referencia"):
        payload["tarifa_referencia"] = result["tarifa_referencia"]

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    try:
        resp = requests.post(
            f"{supabase_url}/rest/v1/utility_data?on_conflict=cpf",
            headers=headers,
            json=payload,
            timeout=12,
        )
        if resp.status_code in [200, 201]:
            logger.info(
                "[SUPABASE] Cooperaliança utility data synchronized to cloud successfully! (Status %d)",
                resp.status_code,
            )
            return True
        logger.warning("[SUPABASE] Sync warning for utility data (Status %d)", resp.status_code)
    except Exception as e:
        logger.warning("[SUPABASE] Network error synchronizing utility data: %s", e)
    return False


def safe_api_get(
    url: str, headers: dict[str, str], timeout: float = 12, default: Any = None
) -> Any:
    """Executes GET request safely shielded against individual endpoint failures."""
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.json().get("Content", default)
        else:
            endpoint_name = url.split("?")[0].split("/")[-1]
            logger.warning("Endpoint %s returned status %d", endpoint_name, r.status_code)
    except Exception as e:
        endpoint_name = url.split("?")[0].split("/")[-1]
        logger.warning("Network failure requesting %s: %s", endpoint_name, e)
    return default


TARIFF_FLAGS = (
    ("RetTarifasBandeiraVerde", "Bandeira verde"),
    ("RetTarifasBandeiraAmarela", "Bandeira amarela"),
    ("RetTarifasBandeiraVermelha", "Bandeira vermelha"),
)


def portal_date_to_iso(value: str | None) -> str | None:
    """Converts a portal date ("DD/MM/YYYY HH:MM:SS") to ISO "YYYY-MM-DD"; returns None if malformed."""
    try:
        return datetime.strptime((value or "").split(" ")[0], "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def fetch_current_tariff(uc: str, headers: dict[str, str]) -> dict[str, Any] | None:
    """Tariff in force for the consumer unit, from the flag the portal marks as current for this billing month.

    Values are per kWh before taxes (TE + TUSD). Returns None when the portal does not report a current flag.
    """
    flags = safe_api_get(API_BASE + f"TarifasBandeiras?codigoUc={uc}", headers, default={}) or {}
    for key, flag_name in TARIFF_FLAGS:
        entry = flags.get(key) or {}
        if entry.get("VigenciaNaCompetencia") and entry.get("TarifaAplicada"):
            return {
                "bandeira_vigente": flag_name,
                "tarifa_kwh": entry["TarifaAplicada"],
                "te_kwh": entry.get("ValorTe"),
                "tusd_kwh": entry.get("ValorTusd"),
                "vigente_desde": portal_date_to_iso(entry.get("DataInicioVigenciaNaCompetencia")),
                "resolucao": (entry.get("DescricaoTarifa") or "").strip() or None,
            }
    return None


def portal_headers() -> dict[str, str]:
    """Headers required by the Cooperaliança portal Useall API."""
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "use-token-externo": TOKEN_EXTERNO,
        "Origin": "https://portal.cooperalianca.com.br",
        "Referer": "https://portal.cooperalianca.com.br/agenciavirtual/",
    }


def login_cooperalianca(
    cpf: str,
    senha: str,
    headers: dict[str, str],
    retry_delays: Sequence[float] = LOGIN_RETRY_DELAYS,
) -> dict[str, Any] | None:
    """Authenticates with utility portal and returns response content (with `Token` and `Nome`), or None.

    Network errors and 5xx responses are retried according to `retry_delays` (seconds):
    the utility portal can be temporarily unstable and typically recovers within minutes.
    """
    payload = {
        "EmailInscricao": cpf.replace(".", "").replace("-", ""),
        "Senha": senha,
        "CorTema": "#003b6d",
    }

    for attempt, delay in enumerate((*retry_delays, None), start=1):
        try:
            resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=30)
            if resp.status_code < 500:
                break
            logger.warning(
                "[COOPERALIANCA] Portal unavailable (Status %d, attempt %d)",
                resp.status_code,
                attempt,
            )
        except requests.RequestException as e:
            logger.warning(
                "[COOPERALIANCA] Connection error with utility portal (attempt %d): %s", attempt, e
            )
        if delay is None:
            return None
        time.sleep(delay)

    if resp.status_code in [401, 403]:
        logger.error(
            "[COOPERALIANCA] Authentication failure (%d). Verify if COOPERALIANCA_TOKEN_EXTERNO in .env expired.",
            resp.status_code,
        )
        return None
    elif resp.status_code != 200:
        logger.error("[COOPERALIANCA] Authentication failed (Status %d)", resp.status_code)
        return None

    content: dict[str, Any] = resp.json().get("Content", {})
    if not content.get("Token"):
        logger.error("[COOPERALIANCA] JWT token missing from authentication response.")
        return None
    return content


def sync_cooperalianca(cpf: str | None = None, senha: str | None = None) -> dict[str, Any] | None:
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")

    if not cpf or not senha:
        logger.error("[COOPERALIANCA] CPF or Password not configured in .env file.")
        return None
    if not UCS:
        logger.error("[COOPERALIANCA] COOPERALIANCA_UCS not configured in .env file.")
        return None

    headers = portal_headers()

    logger.info("[COOPERALIANCA] Starting utility sync (Useall API)")

    auth = login_cooperalianca(cpf, senha, headers)
    if not auth:
        return None

    headers["Authorization"] = f"Bearer {auth['Token']}"
    titular_nome = auth.get("Nome", "")
    logger.info("[COOPERALIANCA] Successfully authenticated!")

    # User profile
    perfil_usuario = safe_api_get(
        API_BASE + f"PerfilUsuario/BuscarPerfilUsuario?codigoUc={UCS[0]}",
        headers=headers,
        default={},
    )

    result: dict[str, Any] = {
        "timestamp": datetime.now().astimezone().isoformat(),
        "distribuidora": "Cooperaliança (Içara/SC)",
        "titular": titular_nome,
        "cpf": cpf,
        "perfil_usuario": perfil_usuario,
        "unidades_consumidoras": {},
    }

    tariff = fetch_current_tariff(UCS[0], headers)
    if tariff:
        result["tarifa_referencia"] = tariff
        logger.info(
            "[COOPERALIANCA] Tariff: %s, R$ %.5f/kWh",
            tariff["bandeira_vigente"],
            tariff["tarifa_kwh"],
        )
    else:
        logger.warning("[COOPERALIANCA] Tariff unavailable; keeping the last stored one")

    for uc in UCS:
        uc_data: dict[str, Any] = {"codigo_uc": uc}

        # A. 60-month invoice and consumption history
        uc_data["historico_faturas_60_meses"] = safe_api_get(
            API_BASE + f"Fatura/RecuperarHistoricoFaturaConsumo60Meses?codigoUc={uc}",
            headers,
            default=[],
        )

        # B. Latest invoice summary
        uc_data["resumo_ultima_fatura"] = safe_api_get(
            API_BASE + f"ImprimirFaturas/RecuperarResumoUltimaFaturaUc?codigoUc={uc}",
            headers,
            default={},
        )

        # C. General Distributed Generation (GD) data
        uc_data["geracao_distribuida"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/RecuperarDadosGeracaoDistribuida?codigoUc={uc}",
            headers,
            default={},
        )

        # D. Full GD extract (credits / compensation balance)
        uc_data["extrato_historico_gd"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/RecuperarDadosHistoricoGeracao?codigoUc={uc}",
            headers,
            default={},
        )

        # E. 12-month Injection vs Consumption vs Balance chart
        uc_data["grafico_historico_12_meses"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo?codigoUc={uc}",
            headers,
            default={},
        )

        result["unidades_consumidoras"][uc] = uc_data

        # Detailed logging for each consumer unit
        gd_info = uc_data.get("geracao_distribuida") or {}
        saldo = gd_info.get("ValorProximoSaldoVencer", 0.0) or 0.0
        pot = gd_info.get("PotenciaInstalada", 0.0) or 0.0
        faturas_count = len(uc_data.get("historico_faturas_60_meses") or [])

        gd_tag = f" | Plant: {pot:.0f} kW | GD Balance: {saldo:,.0f} kWh" if pot > 0 else ""
        logger.info(
            "[COOPERALIANCA] Consumer Unit ••••%s: %d invoices in history%s",
            uc[-4:],
            faturas_count,
            gd_tag,
        )

    # Persist to disk only if explicitly requested via --save-local
    if "--save-local" in sys.argv:
        out_path = os.path.join(DATA_DIR, "cooperalianca_latest.json")
        try:
            atomic_write_json(out_path, result)
            logger.info("[DISK] Data saved locally to: %s", out_path)
        except Exception as e:
            logger.error("[DISK] Error saving cooperalianca_latest.json: %s", e)

    if not push_utility_to_supabase(result):
        return None

    return result


def download_informativo_pdf(
    competencia: str | None = None,
    uc: str | None = None,
    cpf: str | None = None,
    senha: str | None = None,
    output_file: str | None = None,
    data_payload: dict[str, Any] | None = None,
) -> str | None:
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")
    uc = uc or (UCS[0] if UCS else None)
    output_file = output_file or os.path.join(DATA_DIR, "informativo_microgeracao.pdf")

    if not cpf or not senha or not uc:
        logger.error("[PDF] CPF, Password, or UC missing for statement PDF download.")
        return None

    # If billing cycle is not specified, resolve latest cycle from payload or local cache
    if not competencia:
        uc_info = (data_payload or {}).get("unidades_consumidoras", {}).get(str(uc), {})
        if not uc_info:
            latest_file = os.path.join(DATA_DIR, "cooperalianca_latest.json")
            if os.path.exists(latest_file):
                try:
                    with open(latest_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    uc_info = data.get("unidades_consumidoras", {}).get(str(uc), {})
                except Exception as e:
                    # Without the cache the current month is used below as the billing cycle
                    logger.warning("[PDF] Could not read %s: %s", latest_file, e)
        faturas = uc_info.get("historico_faturas_60_meses", [])
        if faturas and isinstance(faturas, list):
            primeira_fat = faturas[0]
            mes_ano = primeira_fat.get("MesAnoCompetencia") or primeira_fat.get("Competencia")
            if mes_ano:
                competencia = f"01/{mes_ano} 00:00:00"
        if not competencia:
            now = datetime.now()
            competencia = f"01/{now.month:02d}/{now.year} 00:00:00"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "use-token-externo": TOKEN_EXTERNO,
        "Origin": "https://portal.cooperalianca.com.br",
        "Referer": "https://portal.cooperalianca.com.br/agenciavirtual/",
    }
    payload = {
        "EmailInscricao": cpf.replace(".", "").replace("-", ""),
        "Senha": senha,
        "CorTema": "#003b6d",
    }

    try:
        resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=12)
        if resp.status_code != 200:
            logger.error("[PDF] Authentication failed for PDF download: %d", resp.status_code)
            return None
        token = resp.json().get("Content", {}).get("Token")
        if not token:
            logger.error("[PDF] Token missing for PDF download.")
            return None
        headers["Authorization"] = f"Bearer {token}"

        pdf_payload = {"CodigoUc": int(uc), "AnoMes": competencia, "NovoInformativo": "S"}
        r_pdf = requests.post(
            API_BASE + "GeracaoDistribuida/InformativoMicrogeracao",
            headers=headers,
            json=pdf_payload,
            timeout=15,
        )
        if r_pdf.status_code == 200:
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "wb") as f:
                f.write(r_pdf.content)
            logger.info(
                "[PDF] Official microgeneration statement (%s) saved to: %s",
                competencia[:10],
                output_file,
            )
            return output_file
        else:
            logger.warning(
                "[PDF] Warning downloading microgeneration statement (%d): %s",
                r_pdf.status_code,
                r_pdf.text[:100],
            )
            return None
    except Exception as e:
        logger.warning("[PDF] Network error downloading PDF: %s", e)
        return None


def main() -> None:
    configure_logging(ENV)
    sync_result = sync_cooperalianca()

    # Exit code 1 marks failure in systemd (visible via `systemctl --failed`)
    if sync_result is None and "--loop" not in sys.argv:
        sys.exit(1)

    if "--pdf" in sys.argv:
        try:
            download_informativo_pdf(data_payload=sync_result)
        except Exception as e:
            logger.warning("[PDF] Warning processing PDF: %s", e)

    if "--loop" in sys.argv:
        logger.info("Periodic utility sync started (24-hour interval). Press Ctrl+C to exit.")
        try:
            while True:
                time.sleep(86400)
                try:
                    sync_cooperalianca()
                except Exception:
                    logger.exception("Error in periodic sync")
        except KeyboardInterrupt:
            logger.info("Utility synchronizer stopped by user (Ctrl+C).")
            sys.exit(0)


if __name__ == "__main__":
    main()
