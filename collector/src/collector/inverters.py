"""Inverter telemetry collector: polls every configured inverter, pushes to Supabase, serves a local API.

Entry points: `python -m collector.inverters`, the `solar-inverters` console script, or the
backward-compatible `python inverters.py` in the collector directory. Flags: `--once` runs a single
cycle, `--save-local` also writes latest.json and history.json to the data directory.
"""

import asyncio
import base64
import json
import logging
import os
import re
import sys
import time
import urllib.request
from collections.abc import Sequence
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any, cast

import requests

from collector.common import atomic_write_json, configure_logging
from collector.settings import CollectorSettings, CollectorState

logger = logging.getLogger("collector.inverters")

try:
    import goodwe
except ImportError:  # pragma: no cover - the dependency is installed on every supported setup
    goodwe = None

try:
    from pysolarmanv5 import PySolarmanV5
except ImportError:  # pragma: no cover - the dependency is installed on every supported setup
    PySolarmanV5 = None

# The local API history keeps one flat `inv_<n>_w` field per inverter, by position in config.json.
# The first three always exist (0 when absent) so consumers of the old three-inverter format keep
# working; a plant with more inverters simply gets inv_4_w, inv_5_w, ...
LEGACY_HISTORY_INVERTER_FIELDS = 3


def queue_offline_telemetry(payload: dict[str, Any], queue_file: str) -> None:
    """Queues telemetry snapshot in local offline buffer if Supabase is temporarily unreachable."""
    queue = []
    if os.path.exists(queue_file):
        try:
            with open(queue_file, "r", encoding="utf-8") as f:
                queue = json.load(f)
        except (OSError, ValueError) as e:
            logger.warning("[BUFFER] Unreadable offline queue, starting a new one: %s", e)
            queue = []
    queue.append(payload)
    if len(queue) > 500:
        queue = queue[-500:]
    try:
        atomic_write_json(queue_file, queue)
    except Exception as e:
        logger.error("[BUFFER] Error saving to offline queue: %s", e)


def flush_offline_queue(supabase_url: str, headers: dict[str, str], queue_file: str) -> None:
    """Flushes queued offline telemetry snapshots to Supabase once connectivity is restored."""
    if not os.path.exists(queue_file):
        return
    try:
        with open(queue_file, "r", encoding="utf-8") as f:
            queue = json.load(f)
    except (OSError, ValueError) as e:
        logger.warning("[BUFFER] Could not read offline queue, skipping flush: %s", e)
        return
    if not queue:
        return

    logger.info(
        "[SUPABASE] Active connection detected! Sending %d pending record(s) from offline queue...",
        len(queue),
    )
    remaining = []
    for idx, item in enumerate(queue):
        try:
            resp = requests.post(
                f"{supabase_url}/rest/v1/solar_telemetry", headers=headers, json=item, timeout=8
            )
            if resp.status_code not in [200, 201]:
                logger.warning(
                    "[SUPABASE] Offline queue replay stopped (Status %d)", resp.status_code
                )
                remaining.extend(queue[idx:])
                break
        except Exception as e:
            logger.warning("[SUPABASE] Offline queue replay interrupted (%s)", type(e).__name__)
            remaining.extend(queue[idx:])
            break

    if remaining:
        try:
            atomic_write_json(queue_file, remaining)
            logger.info("[SUPABASE] %d record(s) retained in queue for next cycle.", len(remaining))
        except Exception as e:
            logger.error("[BUFFER] Error saving remaining offline queue: %s", e)
    else:
        try:
            os.remove(queue_file)
            logger.info("[SUPABASE] All offline records successfully synchronized!")
        except OSError:
            atomic_write_json(queue_file, [])


def get_last_known_energies(state: CollectorState, latest_file: str) -> dict[str, dict[str, float]]:
    """Retrieves today's last known energy generation values in case an inverter is standby or offline at night."""
    try:
        data = state.latest
        if not data and os.path.exists(latest_file):
            with open(latest_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        if not data:
            return {}
        saved_date = data.get("timestamp", "")[:10]
        today_date = datetime.now().strftime("%Y-%m-%d")
        if saved_date == today_date:
            last_known = {}
            for inv in data.get("inverters", []):
                inv_id = inv.get("id")
                if inv_id:
                    last_known[inv_id] = {
                        "energy_today_kwh": inv.get("energy_today_kwh", 0.0),
                        "energy_total_kwh": inv.get("energy_total_kwh", 0.0),
                    }
            return last_known
    except Exception as e:
        # A malformed snapshot only disables the night-time fallback; it must not stop the cycle
        logger.warning("Could not read last known energies: %s", e)
    return {}


STATUS_VAR_PATTERN = re.compile(r'var\s+([a-zA-Z0-9_]+)\s*=\s*["\']([^"\']*)["\'];')


def parse_status_vars(html: str | None) -> dict[str, str]:
    """Extracts JavaScript variables (`var name = "value";`) from logger status.html."""
    return dict(STATUS_VAR_PATTERN.findall(html)) if html else {}


def resolve_logger_serial(logger_sn: int | str | None, status_vars: dict[str, str]) -> int | None:
    """Resolves numeric logger serial: configured logger_sn or status.html `cover_mid`."""
    try:
        return int(str(logger_sn or status_vars.get("cover_mid", "")).strip())
    except ValueError:
        return None


def parse_solis_status(
    html: str | None, regs: list[int] | None = None, logger_sn: int | str | None = None
) -> dict[str, Any]:
    """Extracts raw metrics from Solis LSW-3 logger status HTML and Modbus holding registers."""
    raw_vars = parse_status_vars(html)

    def parse_float(val: Any, default: float = 0.0) -> float:
        try:
            return float(str(val).strip())
        except (ValueError, AttributeError):
            return default

    now_p = parse_float(raw_vars.get("webdata_now_p", "0"))
    today_e = parse_float(raw_vars.get("webdata_today_e", "0"))
    total_e = parse_float(raw_vars.get("webdata_total_e", "0"))
    sn_int = resolve_logger_serial(logger_sn, raw_vars)

    temp_c: float | None = None
    vgrid: float | None = None
    igrid: float | None = None
    fgrid: float | None = None
    pv1_data: dict[str, float] | None = None
    pv2_data: dict[str, float] | None = None

    # Process Solarman V5 Modbus holding registers if available (holding registers 0..39)
    if regs and len(regs) >= 37:
        # PV1
        pv1_v = round(regs[6] * 0.1, 1)
        pv1_i = round(regs[7] * 0.01, 2)
        pv1_w = round(pv1_v * pv1_i, 1)
        pv1_data = {"v": pv1_v, "i": pv1_i, "w": pv1_w}

        # PV2
        pv2_v = round(regs[8] * 0.1, 1)
        pv2_i = round(regs[9] * 0.01, 2)
        pv2_w = round(pv2_v * pv2_i, 1)
        pv2_data = {"v": pv2_v, "i": pv2_i, "w": pv2_w}

        # AC Grid
        fgrid = round(regs[14] * 0.01, 2)
        vgrid = round(regs[15] * 0.1, 1)
        igrid = round(regs[16] * 0.01, 2)

        # Instantaneous Active Power
        if regs[12] > 0:
            now_p = round(regs[12] * 10.0, 1)
        elif vgrid and igrid:
            now_p = round(vgrid * igrid, 1)

        # Energy
        if regs[25] > 0:
            today_e = round(regs[25] * 0.01, 2)
        if regs[22] > 0:
            total_e = float(regs[22])

        # Internal temperature (°C)
        temp_c = round(regs[36] * 0.1, 1)

    return {
        "status": "online",
        "power_w": now_p,
        "energy_today_kwh": today_e,
        "energy_total_kwh": total_e,
        "temperature_c": temp_c,
        "vgrid": vgrid,
        "igrid": igrid,
        "fgrid": fgrid,
        "pv1": pv1_data,
        "pv2": pv2_data,
        "alarm": raw_vars.get("webdata_alarm", ""),
        "inverter_sn": raw_vars.get("webdata_sn", "").strip(),
        "inverter_type": raw_vars.get("webdata_pv_type", "Solis SH1ES160"),
        "logger_sn": str(sn_int or raw_vars.get("cover_mid", "")).strip(),
        "logger_ver": raw_vars.get("cover_ver", "").strip(),
        "wifi_rssi": raw_vars.get("cover_sta_rssi", "N/A"),
        "wifi_ssid": raw_vars.get("cover_sta_ssid", "N/A"),
        "raw_variables": raw_vars,
    }


def fetch_solis_lsw3(
    ip: str,
    logger_sn: int | str | None = None,
    auth_str: str = "admin:admin",
    timeout: float = 4,
) -> dict[str, Any]:
    """Queries Solis inverter via Solarman LSW-3 HTTP status.html and Solarman V5 Modbus."""
    url = f"http://{ip}/status.html"
    html = ""
    try:
        auth = base64.b64encode(auth_str.encode("ascii")).decode("ascii")
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        # Expected every night when the logger powers down with the inverter, hence DEBUG
        logger.debug("Solis status.html unavailable at %s: %s", ip, e)

    sn_int = resolve_logger_serial(logger_sn, parse_status_vars(html))
    regs = None
    if PySolarmanV5 and sn_int:
        try:
            m = PySolarmanV5(
                ip, sn_int, port=8899, mb_slave_id=1, socket_timeout=timeout, verbose=False
            )
            regs = m.read_holding_registers(0, 40)
            m.disconnect()
        except Exception as e:
            # pysolarmanv5 raises several unrelated exception types; also expected at night
            logger.debug("Solarman V5 registers unavailable at %s: %s", ip, e)

    return parse_solis_status(html, regs=regs, logger_sn=logger_sn)


def normalize_goodwe_runtime(
    runtime_data: dict[str, Any], model_name: str = "", serial_number: str = "", firmware: str = ""
) -> dict[str, Any]:
    """Normalizes raw metrics from GoodWe inverter into standard telemetry schema."""

    def parse_f(k: str, default: float = 0.0) -> float:
        val = runtime_data.get(k)
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    power_w = parse_f(
        "total_inverter_power", parse_f("active_power", parse_f("p_grid", parse_f("ppv", 0.0)))
    )
    today_kwh = parse_f("e_day", parse_f("energy_today", 0.0))
    total_kwh = parse_f("e_total", parse_f("energy_total", 0.0))
    temp_c = parse_f("temperature", parse_f("inverter_temperature", 0.0))
    vgrid = parse_f("vgrid1", parse_f("v_grid", 0.0))
    igrid = parse_f("igrid1", parse_f("i_grid", 0.0))
    fgrid = parse_f("fgrid1", parse_f("f_grid", 0.0))

    vpv1 = parse_f("vpv1", 0.0)
    ipv1 = parse_f("ipv1", 0.0)
    ppv1 = parse_f("ppv1", vpv1 * ipv1)

    vpv2 = parse_f("vpv2", 0.0)
    ipv2 = parse_f("ipv2", 0.0)
    ppv2 = parse_f("ppv2", vpv2 * ipv2)

    return {
        "status": "online",
        "power_w": round(power_w, 1),
        "energy_today_kwh": round(today_kwh, 2),
        "energy_total_kwh": round(total_kwh, 1),
        "temperature_c": round(temp_c, 1),
        "vgrid": round(vgrid, 1),
        "igrid": round(igrid, 2),
        "fgrid": round(fgrid, 2),
        "pv1": {"v": round(vpv1, 1), "i": round(ipv1, 2), "w": round(ppv1, 1)},
        "pv2": {"v": round(vpv2, 1), "i": round(ipv2, 2), "w": round(ppv2, 1)},
        "work_mode": str(runtime_data.get("work_mode_label", "Normal")),
        "model": model_name,
        "serial": serial_number,
        "firmware": firmware,
        "sensors_count": len(runtime_data),
        "raw_sensors": {
            k: (str(v) if not isinstance(v, (int, float, bool)) else v)
            for k, v in runtime_data.items()
        },
    }


async def fetch_goodwe_async(
    ip: str, port: int = 502, family: str = "DT", timeout: int = 3, retries: int = 2
) -> dict[str, Any]:
    """Queries GoodWe inverter via Modbus TCP (port 502) with UDP fallback (port 8899)."""
    if goodwe is None:
        raise ImportError("GoodWe library not available.")

    inv = None
    try:
        inv = await goodwe.connect(ip, port=port, family=family, timeout=timeout, retries=retries)
    except Exception as e:
        logger.debug("GoodWe Modbus TCP connection to %s failed (%s), trying UDP", ip, e)
        # Fallback to UDP port 8899 if Modbus TCP is unavailable
        inv = await goodwe.connect(ip, timeout=timeout, retries=retries)

    runtime_data = await inv.read_runtime_data()
    return normalize_goodwe_runtime(
        runtime_data,
        model_name=getattr(inv, "model_name", "") or "",
        serial_number=getattr(inv, "serial_number", "") or "",
        firmware=getattr(inv, "firmware", "") or "",
    )


def collect_inverter(inv_cfg: dict[str, Any]) -> dict[str, Any] | None:
    """Executes telemetry polling for an individual inverter."""
    inv_id = inv_cfg.get("id")
    inv_name = inv_cfg.get("name", inv_id)
    inv_type = inv_cfg.get("type")
    brand = inv_cfg.get("brand", "Unknown")
    ip = cast(str, inv_cfg.get("ip"))

    try:
        if inv_type == "solarman_lsw3":
            auth_str = inv_cfg.get("auth", "admin:admin")
            logger_sn = inv_cfg.get("logger_sn")
            res = fetch_solis_lsw3(ip, logger_sn=logger_sn, auth_str=auth_str, timeout=4)
            return {"id": inv_id, "name": inv_name, "brand": brand, "ip": ip, **res}

        elif inv_type in ["goodwe_udp", "goodwe_tcp", "goodwe"]:
            port = inv_cfg.get("port", 502)
            family = inv_cfg.get("family", "DT")
            timeout = inv_cfg.get("timeout", 4)
            retries = inv_cfg.get("retries", 2)
            res = asyncio.run(
                fetch_goodwe_async(ip, port=port, family=family, timeout=timeout, retries=retries)
            )
            return {"id": inv_id, "name": inv_name, "brand": brand, "ip": ip, **res}

    except Exception as e:
        logger.debug("Inverter %s unreachable: %s", inv_id, e)
        err_msg = str(e)
        return {
            "id": inv_id,
            "name": inv_name,
            "brand": brand,
            "ip": ip,
            "status": "offline / standby",
            "power_w": 0.0,
            "energy_today_kwh": 0.0,
            "energy_total_kwh": 0.0,
            "error": err_msg,
        }
    return None


def push_to_supabase(plant_summary: dict[str, Any], settings: CollectorSettings) -> None:
    """Pushes telemetry snapshot to Supabase cloud with Offline-First queue support."""
    supabase_url = settings.env.get("SUPABASE_URL")
    service_key = settings.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return

    payload = {
        "recorded_at": plant_summary.get("timestamp"),
        "plant_name": plant_summary.get("plant_name"),
        "total_nominal_capacity_kw": plant_summary.get("total_nominal_capacity_kw"),
        "total_power_w": plant_summary.get("total_power_w", 0.0),
        "total_power_kw": plant_summary.get("total_power_kw", 0.0),
        "total_today_kwh": plant_summary.get("total_today_kwh", 0.0),
        "total_lifetime_kwh": plant_summary.get("total_lifetime_kwh", 0.0),
        "capacity_factor_pct": plant_summary.get("capacity_factor_pct", 0.0),
        "inverters_count": plant_summary.get("inverters_count", 3),
        "inverters_data": plant_summary.get("inverters", []),
    }

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }

    queue_file = settings.offline_queue_file
    try:
        resp = requests.post(
            f"{supabase_url}/rest/v1/solar_telemetry", headers=headers, json=payload, timeout=8
        )
        if resp.status_code in [200, 201]:
            logger.info(
                "[SUPABASE] Telemetry synchronized with cloud successfully! (Status %d)",
                resp.status_code,
            )
            flush_offline_queue(supabase_url, headers, queue_file)
        else:
            logger.warning("[SUPABASE] Sync warning (Status %d)", resp.status_code)
            queue_offline_telemetry(payload, queue_file)
    except Exception as e:
        logger.warning(
            "[SUPABASE] No cloud connection (%s). Saving snapshot to local offline queue...",
            type(e).__name__,
        )
        queue_offline_telemetry(payload, queue_file)


def build_history_entry(
    timestamp: str, plant_summary: dict[str, Any], inverters_results: list[dict[str, Any]]
) -> dict[str, Any]:
    """One point of the local API history: plant totals plus inv_<n>_w per inverter, by position."""
    entry: dict[str, Any] = {
        "timestamp": timestamp,
        "power_w": plant_summary["total_power_w"],
        "today_kwh": plant_summary["total_today_kwh"],
    }
    for position in range(max(LEGACY_HISTORY_INVERTER_FIELDS, len(inverters_results))):
        power = (
            inverters_results[position].get("power_w", 0)
            if position < len(inverters_results)
            else 0
        )
        entry[f"inv_{position + 1}_w"] = power
    return entry


def run_collection_cycle(
    settings: CollectorSettings, state: CollectorState, save_local: bool = False
) -> dict[str, Any]:
    """Executes a full polling cycle across all configured inverters and consolidates plant summary."""
    timestamp = datetime.now().astimezone().isoformat()
    inverters_results = []

    total_power_w = 0.0
    total_today_kwh = 0.0
    total_lifetime_kwh = 0.0

    logger.info("[SOLAR TELEMETRY] Starting polling cycle")

    last_known = get_last_known_energies(state, settings.latest_file)

    for inv_cfg in settings.inverters:
        if not inv_cfg.get("enabled", True):
            continue
        res = collect_inverter(inv_cfg)
        if res is None:
            # Same outcome as before (the cycle fails and main() logs it), with a clearer message
            raise ValueError(
                f"Inverter {inv_cfg.get('id')!r} has unsupported type {inv_cfg.get('type')!r}"
            )
        inv_id = res.get("id")

        # If inverter is offline (e.g. night/standby), reuse last known daily energy from today
        if res.get("status") != "online" and inv_id in last_known:
            res["energy_today_kwh"] = last_known[inv_id].get("energy_today_kwh", 0.0)
            res["energy_total_kwh"] = last_known[inv_id].get("energy_total_kwh", 0.0)

        inverters_results.append(res)

        p_w = res.get("power_w", 0.0)
        e_today = res.get("energy_today_kwh", 0.0)
        e_tot = res.get("energy_total_kwh", 0.0)

        total_power_w += p_w
        total_today_kwh += e_today
        total_lifetime_kwh += e_tot

        status_tag = "[ONLINE]" if res.get("status") == "online" else "[OFFLINE]"
        temp_info = f" | {res['temperature_c']}°C" if res.get("temperature_c") else ""
        vgrid_info = f" | {int(res['vgrid'])}V" if res.get("vgrid") else ""
        logger.info(
            "%s %s: %7.1f W | Today: %5.2f kWh | Total: %7.1f kWh%s%s",
            status_tag,
            res.get("name"),
            p_w,
            e_today,
            e_tot,
            temp_info,
            vgrid_info,
        )

    nominal_kw = settings.nominal_capacity_kw
    plant_summary = {
        "timestamp": timestamp,
        "plant_name": settings.plant_name,
        "total_nominal_capacity_kw": nominal_kw,
        "total_power_w": round(total_power_w, 1),
        "total_power_kw": round(total_power_w / 1000.0, 2),
        "total_today_kwh": round(total_today_kwh, 2),
        "total_lifetime_kwh": round(total_lifetime_kwh, 1),
        "capacity_factor_pct": round((total_power_w / (nominal_kw * 1000.0)) * 100.0, 1),
        "inverters_count": len(inverters_results),
        "inverters": inverters_results,
    }

    logger.info(
        "PLANT TOTAL    : %7.1f W (%.2f kW) | %s%% capacity factor",
        total_power_w,
        total_power_w / 1000.0,
        plant_summary["capacity_factor_pct"],
    )
    logger.info(
        "TODAY GENERATED: %7.2f kWh | LIFETIME TOTAL : %s kWh",
        total_today_kwh,
        f"{total_lifetime_kwh:,.1f}",
    )

    # Keep in-memory state for embedded REST API
    state.latest = plant_summary
    history_entry = build_history_entry(timestamp, plant_summary, inverters_results)
    state.history = [*state.history, history_entry][-settings.history_max_records :]

    # Persist to disk only if explicitly requested via --save-local
    if save_local:
        try:
            atomic_write_json(settings.latest_file, plant_summary)
        except Exception as e:
            logger.error("[DISK] Error writing latest.json: %s", e)

        try:
            atomic_write_json(settings.history_file, state.history)
        except Exception as e:
            logger.error("[DISK] Error writing history.json: %s", e)

    # Automatically synchronize with Supabase (Cloud)
    push_to_supabase(plant_summary, settings)

    return plant_summary


class SolarApiServer(ThreadingHTTPServer):
    """Local API server bound to the collector state it serves."""

    def __init__(
        self,
        address: tuple[str, int],
        state: CollectorState,
        latest_file: str,
        history_file: str,
    ) -> None:
        super().__init__(address, SolarApiHandler)
        self.state = state
        self.latest_file = latest_file
        self.history_file = history_file


# Thread-Safe Embedded REST API
class SolarApiHandler(BaseHTTPRequestHandler):
    server: SolarApiServer

    def _send_json(self, data: Any, status: int = 200) -> None:
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError):
            pass

    def do_GET(self) -> None:
        state = self.server.state
        latest_file = self.server.latest_file
        history_file = self.server.history_file
        if self.path == "/api/latest":
            latest = state.latest
            if latest:
                self._send_json(latest)
            elif os.path.exists(latest_file):
                try:
                    with open(latest_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except (OSError, ValueError) as e:
                    logger.warning("[API] Could not read %s: %s", latest_file, e)
                    self._send_json({"error": "Telemetry file read error"}, 500)
            else:
                self._send_json({"error": "No telemetry data collected yet"}, 404)

        elif self.path == "/api/history":
            history = state.history
            if history:
                self._send_json(history)
            elif os.path.exists(history_file):
                try:
                    with open(history_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except (OSError, ValueError) as e:
                    logger.warning("[API] Could not read %s: %s", history_file, e)
                    self._send_json([])
            else:
                self._send_json([])

        elif self.path == "/api/health":
            self._send_json({"status": "ok", "time": datetime.now().isoformat()})

        else:
            self._send_json(
                {
                    "error": "Route not found",
                    "available_routes": ["/api/latest", "/api/history", "/api/health"],
                    "rotas_disponiveis": ["/api/latest", "/api/history", "/api/health"],
                },
                404,
            )

    def log_message(self, format: str, *args: Any) -> None:
        # Access log goes to DEBUG instead of stderr, to keep the journal quiet
        logger.debug("[API] " + format, *args)


def start_http_server(
    settings: CollectorSettings,
    state: CollectorState,
    host: str = "127.0.0.1",
    port: int = 5000,
) -> None:
    server = None
    selected_port = port
    for p in [port, port + 1, port + 2]:
        try:
            server = SolarApiServer((host, p), state, settings.latest_file, settings.history_file)
            selected_port = p
            break
        except OSError as e:
            if getattr(e, "errno", None) == 10048 or "Address already in use" in str(e):
                continue
            else:
                logger.warning("[API] Could not start HTTP server on %s:%d: %s", host, p, e)
                return

    if server:
        logger.info("[API] Local REST API started at: http://%s:%d/api/latest", host, selected_port)
        try:
            server.serve_forever()
        except Exception:
            # The API is optional: the collection loop keeps running without it
            logger.exception("[API] Local REST API stopped unexpectedly")
    else:
        logger.warning(
            "[API] Ports %d to %d are occupied. Collector will continue running normally.",
            port,
            port + 2,
        )


def main(argv: Sequence[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    settings = CollectorSettings.load()
    configure_logging(settings.env)
    os.makedirs(settings.data_dir, exist_ok=True)
    state = CollectorState()

    api_host, api_port = settings.api_address
    poll_sec = settings.poll_interval_seconds
    save_local = "--save-local" in args

    if "--once" in args:
        run_collection_cycle(settings, state, save_local=save_local)
        return

    server_thread = Thread(
        target=start_http_server, args=(settings, state, api_host, api_port), daemon=True
    )
    server_thread.start()
    logger.info("Configured polling interval: %s seconds (%.1f min)", poll_sec, poll_sec / 60)

    try:
        while True:
            try:
                run_collection_cycle(settings, state, save_local=save_local)
            except Exception:
                logger.exception("Error in polling cycle")
            time.sleep(poll_sec)
    except KeyboardInterrupt:
        logger.info("Collector cleanly stopped by user (Ctrl+C).")
        sys.exit(0)


if __name__ == "__main__":
    main()
