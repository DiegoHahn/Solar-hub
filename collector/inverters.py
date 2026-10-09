import asyncio
import base64
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import requests

from common import atomic_write_json
from common import load_env as _load_env

# Ensures UTF-8 support in Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import goodwe
except ImportError:
    goodwe = None

try:
    from pysolarmanv5 import PySolarmanV5
except ImportError:
    PySolarmanV5 = None

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")


def load_env():
    return _load_env(ENV_FILE)


ENV = load_env()


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "poll_interval_seconds": 600,
        "data_dir": "data",
        "history_max_records": 1000,
        "api_port": 5000,
        "inverters": [],
    }


config = load_config()
DATA_DIR = os.path.join(os.path.dirname(__file__), config.get("data_dir", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
OFFLINE_QUEUE_FILE = os.path.join(DATA_DIR, "offline_queue.json")

# Inserts are idempotent: a snapshot whose recorded_at already exists is skipped by PostgREST
# (INSERT ... ON CONFLICT (recorded_at) DO NOTHING), so an interrupted queue replay can be resent.
# Requires the unique constraint from migration 20261009150000_unique_solar_telemetry_recorded_at.
TELEMETRY_ENDPOINT = "/rest/v1/solar_telemetry?on_conflict=recorded_at"


def queue_offline_telemetry(payload):
    """Queues telemetry snapshot in local offline buffer if Supabase is temporarily unreachable."""
    queue = []
    if os.path.exists(OFFLINE_QUEUE_FILE):
        try:
            with open(OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
                queue = json.load(f)
        except Exception:
            queue = []
    queue.append(payload)
    if len(queue) > 500:
        queue = queue[-500:]
    try:
        atomic_write_json(OFFLINE_QUEUE_FILE, queue)
    except Exception as e:
        print(f" [BUFFER] Error saving to offline queue: {e}")


def flush_offline_queue(supabase_url, headers):
    """Flushes queued offline telemetry snapshots to Supabase once connectivity is restored."""
    if not os.path.exists(OFFLINE_QUEUE_FILE):
        return
    try:
        with open(OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
            queue = json.load(f)
    except Exception:
        return
    if not queue:
        return

    print(
        f" [SUPABASE] Active connection detected! Sending {len(queue)} pending record(s) from offline queue..."
    )
    remaining = []
    for idx, item in enumerate(queue):
        try:
            resp = requests.post(
                f"{supabase_url}{TELEMETRY_ENDPOINT}", headers=headers, json=item, timeout=8
            )
            if resp.status_code not in [200, 201]:
                remaining.extend(queue[idx:])
                break
        except Exception:
            remaining.extend(queue[idx:])
            break

    if remaining:
        try:
            atomic_write_json(OFFLINE_QUEUE_FILE, remaining)
            print(f" [SUPABASE] {len(remaining)} record(s) retained in queue for next cycle.")
        except Exception:
            pass
    else:
        try:
            os.remove(OFFLINE_QUEUE_FILE)
            print(" [SUPABASE] All offline records successfully synchronized!")
        except OSError:
            atomic_write_json(OFFLINE_QUEUE_FILE, [])


def get_last_known_energies():
    """Retrieves today's last known energy generation values in case an inverter is standby or offline at night."""
    global _LATEST_IN_MEMORY
    try:
        data = _LATEST_IN_MEMORY
        if not data and os.path.exists(LATEST_FILE):
            with open(LATEST_FILE, "r", encoding="utf-8") as f:
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
    except Exception:
        pass
    return {}


STATUS_VAR_PATTERN = re.compile(r'var\s+([a-zA-Z0-9_]+)\s*=\s*["\']([^"\']*)["\'];')


def parse_status_vars(html):
    """Extracts JavaScript variables (`var name = "value";`) from logger status.html."""
    return dict(STATUS_VAR_PATTERN.findall(html)) if html else {}


def resolve_logger_serial(logger_sn, status_vars):
    """Resolves numeric logger serial: configured logger_sn or status.html `cover_mid`."""
    try:
        return int(str(logger_sn or status_vars.get("cover_mid", "")).strip())
    except ValueError:
        return None


def parse_solis_status(html, regs=None, logger_sn=None):
    """Extracts raw metrics from Solis LSW-3 logger status HTML and Modbus holding registers."""
    raw_vars = parse_status_vars(html)

    def parse_float(val, default=0.0):
        try:
            return float(str(val).strip())
        except (ValueError, AttributeError):
            return default

    now_p = parse_float(raw_vars.get("webdata_now_p", "0"))
    today_e = parse_float(raw_vars.get("webdata_today_e", "0"))
    total_e = parse_float(raw_vars.get("webdata_total_e", "0"))
    sn_int = resolve_logger_serial(logger_sn, raw_vars)

    temp_c = None
    vgrid = None
    igrid = None
    fgrid = None
    pv1_data = None
    pv2_data = None

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


def fetch_solis_lsw3(ip, logger_sn=None, auth_str="admin:admin", timeout=4):
    """Queries Solis inverter via Solarman LSW-3 HTTP status.html and Solarman V5 Modbus."""
    url = f"http://{ip}/status.html"
    html = ""
    try:
        auth = base64.b64encode(auth_str.encode("ascii")).decode("ascii")
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        pass

    sn_int = resolve_logger_serial(logger_sn, parse_status_vars(html))
    regs = None
    if PySolarmanV5 and sn_int:
        try:
            m = PySolarmanV5(
                ip, sn_int, port=8899, mb_slave_id=1, socket_timeout=timeout, verbose=False
            )
            regs = m.read_holding_registers(0, 40)
            m.disconnect()
        except Exception:
            pass

    return parse_solis_status(html, regs=regs, logger_sn=logger_sn)


def normalize_goodwe_runtime(runtime_data, model_name="", serial_number="", firmware=""):
    """Normalizes raw metrics from GoodWe inverter into standard telemetry schema."""

    def parse_f(k, default=0.0):
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


async def fetch_goodwe_async(ip, port=502, family="DT", timeout=3, retries=2):
    """Queries GoodWe inverter via Modbus TCP (port 502) with UDP fallback (port 8899)."""
    if goodwe is None:
        raise ImportError("GoodWe library not available.")

    inv = None
    try:
        inv = await goodwe.connect(ip, port=port, family=family, timeout=timeout, retries=retries)
    except Exception:
        # Fallback to UDP port 8899 if Modbus TCP is unavailable
        inv = await goodwe.connect(ip, timeout=timeout, retries=retries)

    runtime_data = await inv.read_runtime_data()
    return normalize_goodwe_runtime(
        runtime_data,
        model_name=getattr(inv, "model_name", "") or "",
        serial_number=getattr(inv, "serial_number", "") or "",
        firmware=getattr(inv, "firmware", "") or "",
    )


def collect_inverter(inv_cfg):
    """Executes telemetry polling for an individual inverter."""
    inv_id = inv_cfg.get("id")
    inv_name = inv_cfg.get("name", inv_id)
    inv_type = inv_cfg.get("type")
    brand = inv_cfg.get("brand", "Unknown")
    ip = inv_cfg.get("ip")

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


def push_to_supabase(plant_summary):
    """Pushes telemetry snapshot to Supabase cloud with Offline-First queue support."""
    supabase_url = ENV.get("SUPABASE_URL")
    service_key = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return

    payload = {
        # Never null: recorded_at is the deduplication key of the offline queue replay
        "recorded_at": plant_summary.get("timestamp") or datetime.now().astimezone().isoformat(),
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
        "Prefer": "resolution=ignore-duplicates",
    }

    try:
        resp = requests.post(
            f"{supabase_url}{TELEMETRY_ENDPOINT}", headers=headers, json=payload, timeout=8
        )
        if resp.status_code in [200, 201]:
            print(
                f" [SUPABASE] Telemetry synchronized with cloud successfully! (Status {resp.status_code})"
            )
            flush_offline_queue(supabase_url, headers)
        else:
            print(f" [SUPABASE] Sync warning (Status {resp.status_code})")
            queue_offline_telemetry(payload)
    except Exception as e:
        print(
            f" [SUPABASE] No cloud connection ({type(e).__name__}). Saving snapshot to local offline queue..."
        )
        queue_offline_telemetry(payload)


def run_collection_cycle():
    """Executes a full polling cycle across all configured inverters and consolidates plant summary."""
    timestamp = datetime.now().astimezone().isoformat()
    inverters_results = []

    total_power_w = 0.0
    total_today_kwh = 0.0
    total_lifetime_kwh = 0.0

    print("\n=======================================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [SOLAR TELEMETRY] STARTING POLLING CYCLE")
    print("=======================================================")

    last_known = get_last_known_energies()

    for inv_cfg in config.get("inverters", []):
        if not inv_cfg.get("enabled", True):
            continue
        res = collect_inverter(inv_cfg)
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
        print(
            f" {status_tag} {res.get('name')}: {p_w:7.1f} W | Today: {e_today:5.2f} kWh | Total: {e_tot:7.1f} kWh{temp_info}{vgrid_info}"
        )

    nominal_kw = config.get("nominal_capacity_kw", 16.0)
    plant_summary = {
        "timestamp": timestamp,
        "plant_name": config.get("plant_name", "Solar Plant"),
        "total_nominal_capacity_kw": nominal_kw,
        "total_power_w": round(total_power_w, 1),
        "total_power_kw": round(total_power_w / 1000.0, 2),
        "total_today_kwh": round(total_today_kwh, 2),
        "total_lifetime_kwh": round(total_lifetime_kwh, 1),
        "capacity_factor_pct": round((total_power_w / (nominal_kw * 1000.0)) * 100.0, 1),
        "inverters_count": len(inverters_results),
        "inverters": inverters_results,
    }

    print("-------------------------------------------------------")
    print(
        f" PLANT TOTAL    : {total_power_w:7.1f} W ({total_power_w / 1000.0:.2f} kW) | {plant_summary['capacity_factor_pct']}% capacity factor"
    )
    print(
        f" TODAY GENERATED: {total_today_kwh:7.2f} kWh | LIFETIME TOTAL : {total_lifetime_kwh:,.1f} kWh"
    )
    print("=======================================================")

    # Keep in-memory state for embedded REST API
    global _LATEST_IN_MEMORY, _HISTORY_IN_MEMORY
    _LATEST_IN_MEMORY = plant_summary

    history_entry = {
        "timestamp": timestamp,
        "power_w": plant_summary["total_power_w"],
        "today_kwh": plant_summary["total_today_kwh"],
        "inv_1_w": inverters_results[0].get("power_w", 0) if len(inverters_results) > 0 else 0,
        "inv_2_w": inverters_results[1].get("power_w", 0) if len(inverters_results) > 1 else 0,
        "inv_3_w": inverters_results[2].get("power_w", 0) if len(inverters_results) > 2 else 0,
    }
    _HISTORY_IN_MEMORY.append(history_entry)
    max_records = config.get("history_max_records", 1000)
    if len(_HISTORY_IN_MEMORY) > max_records:
        _HISTORY_IN_MEMORY = _HISTORY_IN_MEMORY[-max_records:]

    # Persist to disk only if explicitly requested via --save-local
    if "--save-local" in sys.argv:
        try:
            atomic_write_json(LATEST_FILE, plant_summary)
        except Exception as e:
            print(f" [DISK] Error writing latest.json: {e}")

        try:
            atomic_write_json(HISTORY_FILE, _HISTORY_IN_MEMORY)
        except Exception as e:
            print(f" [DISK] Error writing history.json: {e}")

    # Automatically synchronize with Supabase (Cloud)
    push_to_supabase(plant_summary)

    return plant_summary


# In-memory cache to prevent SD card wear on Orange Pi
_LATEST_IN_MEMORY = None
_HISTORY_IN_MEMORY = []


# Thread-Safe Embedded REST API
class SolarApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError):
            pass

    def do_GET(self):
        if self.path == "/api/latest":
            if _LATEST_IN_MEMORY:
                self._send_json(_LATEST_IN_MEMORY)
            elif os.path.exists(LATEST_FILE):
                try:
                    with open(LATEST_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except Exception:
                    self._send_json({"error": "Telemetry file read error"}, 500)
            else:
                self._send_json({"error": "No telemetry data collected yet"}, 404)

        elif self.path == "/api/history":
            if _HISTORY_IN_MEMORY:
                self._send_json(_HISTORY_IN_MEMORY)
            elif os.path.exists(HISTORY_FILE):
                try:
                    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except Exception:
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

    def log_message(self, format, *args):
        pass


def start_http_server(host="127.0.0.1", port=5000):
    server = None
    selected_port = port
    for p in [port, port + 1, port + 2]:
        try:
            server = ThreadingHTTPServer((host, p), SolarApiHandler)
            selected_port = p
            break
        except OSError as e:
            if getattr(e, "errno", None) == 10048 or "Address already in use" in str(e):
                continue
            else:
                print(f" [!] Warning starting HTTP server on {host}:{p}: {e}")
                return

    if server:
        print(f" [*] Local REST API started at: http://{host}:{selected_port}/api/latest")
        try:
            server.serve_forever()
        except Exception:
            pass
    else:
        print(
            f" [!] Warning: Ports {port} to {port + 2} are occupied. Collector will continue running normally."
        )


def main():
    api_cfg = config.get("api", {})
    if isinstance(api_cfg, dict):
        api_host = api_cfg.get("host", "127.0.0.1")
        api_port = api_cfg.get("port", config.get("api_port", 5000))
    else:
        api_host = "127.0.0.1"
        api_port = config.get("api_port", 5000)

    poll_sec = config.get("poll_interval_seconds", 600)

    if "--once" in sys.argv:
        run_collection_cycle()
        return

    server_thread = Thread(target=start_http_server, args=(api_host, api_port), daemon=True)
    server_thread.start()
    print(f"[*] Configured polling interval: {poll_sec} seconds ({poll_sec / 60:.1f} min)")

    try:
        while True:
            try:
                run_collection_cycle()
            except Exception as e:
                print(f" [!] Error in polling cycle: {e}")
            time.sleep(poll_sec)
    except KeyboardInterrupt:
        print("\n[*] Collector cleanly stopped by user (Ctrl+C).")
        sys.exit(0)


if __name__ == "__main__":
    main()
