import os
import sys
import json
import time
import base64
import urllib.request
import re
import asyncio
import requests
from datetime import datetime
from threading import Thread
from http.server import HTTPServer, BaseHTTPRequestHandler

# Garante suporte a UTF-8 no terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import goodwe
except ImportError:
    goodwe = None

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

def load_env():
    env_vars = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

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
        "inverters": []
    }

config = load_config()
DATA_DIR = os.path.join(os.path.dirname(__file__), config.get("data_dir", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

def fetch_solis_lsw3(ip, auth_str="admin:admin", timeout=4):
    """Consulta inversor Solis via logger Solarman LSW-3 HTTP status.html."""
    url = f"http://{ip}/status.html"
    auth = base64.b64encode(auth_str.encode("ascii")).decode("ascii")
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
    
    with urllib.request.urlopen(req, timeout=timeout) as response:
        html = response.read().decode("utf-8", errors="ignore")
    
    var_pattern = re.compile(r'var\s+([a-zA-Z0-9_]+)\s*=\s*["\']([^"\']*)["\'];')
    raw_vars = dict(var_pattern.findall(html))
    
    def parse_float(val, default=0.0):
        try:
            return float(val.strip())
        except (ValueError, AttributeError):
            return default
            
    now_p = parse_float(raw_vars.get("webdata_now_p", "0"))
    today_e = parse_float(raw_vars.get("webdata_today_e", "0"))
    total_e = parse_float(raw_vars.get("webdata_total_e", "0"))
    
    return {
        "status": "online",
        "power_w": now_p,
        "energy_today_kwh": today_e,
        "energy_total_kwh": total_e,
        "alarm": raw_vars.get("webdata_alarm", ""),
        "inverter_sn": raw_vars.get("webdata_sn", "").strip(),
        "inverter_type": raw_vars.get("webdata_pv_type", "Solis SH1ES160"),
        "logger_sn": raw_vars.get("cover_mid", "").strip(),
        "logger_ver": raw_vars.get("cover_ver", "").strip(),
        "wifi_rssi": raw_vars.get("cover_sta_rssi", "N/A"),
        "wifi_ssid": raw_vars.get("cover_sta_ssid", "N/A"),
        "raw_variables": raw_vars
    }

async def fetch_goodwe_udp_async(ip, timeout=3, retries=2):
    """Consulta inversor GoodWe via UDP porta 8899."""
    if goodwe is None:
        raise ImportError("Biblioteca goodwe nao disponivel.")
    
    inv = await goodwe.connect(ip, timeout=timeout, retries=retries)
    runtime_data = await inv.read_runtime_data()
    
    def parse_f(k, default=0.0):
        val = runtime_data.get(k)
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    power_w = parse_f("total_inverter_power", parse_f("active_power", parse_f("p_grid", 0.0)))
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
        "model": inv.model_name,
        "serial": inv.serial_number,
        "firmware": inv.firmware,
        "sensors_count": len(runtime_data),
        "raw_sensors": {k: (str(v) if not isinstance(v, (int, float, bool)) else v) for k, v in runtime_data.items()}
    }

def collect_inverter(inv_cfg):
    """Executa a coleta de um inversor individual."""
    inv_id = inv_cfg.get("id")
    inv_name = inv_cfg.get("name", inv_id)
    inv_type = inv_cfg.get("type")
    brand = inv_cfg.get("brand", "Unknown")
    ip = inv_cfg.get("ip")

    try:
        if inv_type == "solarman_lsw3":
            auth_str = inv_cfg.get("auth", "admin:admin")
            res = fetch_solis_lsw3(ip, auth_str=auth_str, timeout=4)
            return {"id": inv_id, "name": inv_name, "brand": brand, "ip": ip, **res}
            
        elif inv_type == "goodwe_udp":
            res = asyncio.run(fetch_goodwe_udp_async(ip, timeout=3, retries=2))
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
            "error": err_msg
        }

def push_to_supabase(plant_summary):
    """Envia o snapshot de telemetria para o Supabase (Nuvem)."""
    supabase_url = ENV.get("SUPABASE_URL")
    service_key = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return

    payload = {
        "recorded_at": plant_summary.get("timestamp"),
        "plant_name": plant_summary.get("plant_name", "Usina Solar Diego Hahn (16 kW)"),
        "total_nominal_capacity_kw": plant_summary.get("total_nominal_capacity_kw", 16.0),
        "total_power_w": plant_summary.get("total_power_w", 0.0),
        "total_power_kw": plant_summary.get("total_power_kw", 0.0),
        "total_today_kwh": plant_summary.get("total_today_kwh", 0.0),
        "total_lifetime_kwh": plant_summary.get("total_lifetime_kwh", 0.0),
        "capacity_factor_pct": plant_summary.get("capacity_factor_pct", 0.0),
        "inverters_count": plant_summary.get("inverters_count", 3),
        "inverters_data": plant_summary.get("inverters", [])
    }
    
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(f"{supabase_url}/rest/v1/solar_telemetry", headers=headers, json=payload, timeout=8)
        if resp.status_code in [200, 201]:
            print(f" ☁️ [SUPABASE] Telemetria sincronizada na nuvem com sucesso! (Status {resp.status_code})")
        else:
            print(f" ⚠️ [SUPABASE] Aviso ao sincronizar: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f" ⚠️ [SUPABASE] Erro de rede ao sincronizar com a nuvem: {e}")

def run_collection_cycle():
    """Executa um ciclo completo de leitura dos 3 inversores e consolida os dados."""
    timestamp = datetime.now().isoformat()
    inverters_results = []
    
    total_power_w = 0.0
    total_today_kwh = 0.0
    total_lifetime_kwh = 0.0
    
    print(f"\n=======================================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [TELEMETRIA SOLAR] INICIANDO CICLO DE LEITURA")
    print(f"=======================================================")

    for inv_cfg in config.get("inverters", []):
        if not inv_cfg.get("enabled", True):
            continue
        res = collect_inverter(inv_cfg)
        inverters_results.append(res)
        
        p_w = res.get("power_w", 0.0)
        e_today = res.get("energy_today_kwh", 0.0)
        e_tot = res.get("energy_total_kwh", 0.0)
        
        total_power_w += p_w
        total_today_kwh += e_today
        total_lifetime_kwh += e_tot
        
        status_tag = "[ONLINE]" if res.get("status") == "online" else "[OFFLINE]"
        print(f" {status_tag} {res.get('name')}: {p_w:7.1f} W | Hoje: {e_today:5.2f} kWh | Total: {e_tot:7.1f} kWh")

    plant_summary = {
        "timestamp": timestamp,
        "plant_name": "Usina Solar Diego Hahn (16 kW)",
        "total_nominal_capacity_kw": 16.0,
        "total_power_w": round(total_power_w, 1),
        "total_power_kw": round(total_power_w / 1000.0, 2),
        "total_today_kwh": round(total_today_kwh, 2),
        "total_lifetime_kwh": round(total_lifetime_kwh, 1),
        "capacity_factor_pct": round((total_power_w / 16000.0) * 100.0, 1),
        "inverters_count": len(inverters_results),
        "inverters": inverters_results
    }
    
    print(f"-------------------------------------------------------")
    print(f" TOTAL DA USINA : {total_power_w:7.1f} W ({total_power_w/1000.0:.2f} kW) | {plant_summary['capacity_factor_pct']}% da capacidade")
    print(f" GERACAO HOJE   : {total_today_kwh:7.2f} kWh | TOTAL ACUMULADO: {total_lifetime_kwh:,.1f} kWh")
    print(f"=======================================================")

    # Salva latest.json
    with open(LATEST_FILE, "w", encoding="utf-8") as f:
        json.dump(plant_summary, f, indent=2, ensure_ascii=False)

    # Atualiza history.json
    history_records = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history_records = json.load(f)
        except Exception:
            history_records = []

    history_entry = {
        "timestamp": timestamp,
        "power_w": plant_summary["total_power_w"],
        "today_kwh": plant_summary["total_today_kwh"],
        "inv_1_w": inverters_results[0].get("power_w", 0) if len(inverters_results) > 0 else 0,
        "inv_2_w": inverters_results[1].get("power_w", 0) if len(inverters_results) > 1 else 0,
        "inv_3_w": inverters_results[2].get("power_w", 0) if len(inverters_results) > 2 else 0
    }
    history_records.append(history_entry)
    
    max_records = config.get("history_max_records", 1000)
    if len(history_records) > max_records:
        history_records = history_records[-max_records:]
        
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_records, f, indent=2, ensure_ascii=False)

    # Sincroniza automaticamente com o Supabase (Nuvem)
    push_to_supabase(plant_summary)

    return plant_summary

# REST API Embutida
class SolarApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/latest":
            if os.path.exists(LATEST_FILE):
                with open(LATEST_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._send_json(data)
            else:
                self._send_json({"error": "Nenhum dado coletado ainda"}, 404)
                
        elif self.path == "/api/history":
            if os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._send_json(data)
            else:
                self._send_json([])

        elif self.path == "/api/trigger":
            summary = run_collection_cycle()
            self._send_json({"status": "success", "summary": summary})
            
        elif self.path == "/api/health":
            self._send_json({"status": "ok", "time": datetime.now().isoformat()})
            
        else:
            self._send_json({"error": "Rota nao encontrada", "rotas_disponiveis": ["/api/latest", "/api/history", "/api/trigger", "/api/health"]}, 404)

    def log_message(self, format, *args):
        pass

def start_http_server(port=5000):
    server = HTTPServer(("0.0.0.0", port), SolarApiHandler)
    server.serve_forever()

def main():
    api_port = config.get("api_port", 5000)
    poll_sec = config.get("poll_interval_seconds", 600)
    
    if "--once" in sys.argv:
        run_collection_cycle()
        return

    server_thread = Thread(target=start_http_server, args=(api_port,), daemon=True)
    server_thread.start()
    print(f"[*] API REST Local iniciada em: http://localhost:{api_port}/api/latest")
    print(f"[*] Intervalo de coleta configurado: {poll_sec} segundos ({poll_sec/60:.1f} min)")

    while True:
        try:
            run_collection_cycle()
        except Exception as e:
            print(f"Erro no ciclo de coleta: {e}")
        time.sleep(poll_sec)

if __name__ == "__main__":
    main()
