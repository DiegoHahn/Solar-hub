import os
import sys
import json
import time
import base64
import urllib.request
import re
import asyncio
import requests
from datetime import datetime, timezone
from threading import Thread
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler

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
OFFLINE_QUEUE_FILE = os.path.join(DATA_DIR, "offline_queue.json")

def atomic_write_json(filepath, data):
    """Grava JSON de forma atômica usando arquivo temporário para evitar corrupção por leitura simultânea."""
    dir_name = os.path.dirname(filepath)
    os.makedirs(dir_name, exist_ok=True)
    temp_file = filepath + f".tmp_{os.getpid()}_{int(time.time()*1000)}"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_file, filepath)
    except Exception as e:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
        raise e

def queue_offline_telemetry(payload):
    """Guarda snapshot no buffer offline caso o Supabase esteja temporariamente inacessível."""
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
        print(f" ⚠️ [BUFFER] Erro ao salvar na fila offline: {e}")

def flush_offline_queue(supabase_url, headers):
    """Tenta enviar dados acumulados na fila offline para o Supabase quando a conexão voltar."""
    if not os.path.exists(OFFLINE_QUEUE_FILE):
        return
    try:
        with open(OFFLINE_QUEUE_FILE, "r", encoding="utf-8") as f:
            queue = json.load(f)
    except Exception:
        return
    if not queue:
        return

    print(f" 📦 [SUPABASE] Conexão ativa detectada! Enviando {len(queue)} registro(s) pendente(s) da fila offline...")
    remaining = []
    for idx, item in enumerate(queue):
        try:
            resp = requests.post(f"{supabase_url}/rest/v1/solar_telemetry", headers=headers, json=item, timeout=8)
            if resp.status_code not in [200, 201]:
                remaining.extend(queue[idx:])
                break
        except Exception:
            remaining.extend(queue[idx:])
            break

    if remaining:
        try:
            atomic_write_json(OFFLINE_QUEUE_FILE, remaining)
            print(f" ⚠️ [SUPABASE] {len(remaining)} registro(s) mantido(s) na fila para o próximo ciclo.")
        except Exception:
            pass
    else:
        try:
            os.remove(OFFLINE_QUEUE_FILE)
            print(" ✅ [SUPABASE] Todos os registros acumulados offline foram sincronizados com sucesso!")
        except OSError:
            atomic_write_json(OFFLINE_QUEUE_FILE, [])

def get_last_known_energies():
    """Recupera os últimos valores de energia diária de hoje caso algum inversor fique offline à noite ou em standby."""
    if not os.path.exists(LATEST_FILE):
        return {}
    try:
        with open(LATEST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        saved_date = data.get("timestamp", "")[:10]
        today_date = datetime.now().strftime("%Y-%m-%d")
        if saved_date == today_date:
            last_known = {}
            for inv in data.get("inverters", []):
                inv_id = inv.get("id")
                if inv_id:
                    last_known[inv_id] = {
                        "energy_today_kwh": inv.get("energy_today_kwh", 0.0),
                        "energy_total_kwh": inv.get("energy_total_kwh", 0.0)
                    }
            return last_known
    except Exception:
        pass
    return {}

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

async def fetch_goodwe_async(ip, port=502, family="DT", timeout=3, retries=2):
    """Consulta inversor GoodWe via Modbus TCP (porta 502) ou fallback UDP (porta 8899)."""
    if goodwe is None:
        raise ImportError("Biblioteca goodwe nao disponivel.")
    
    inv = None
    try:
        inv = await goodwe.connect(ip, port=port, family=family, timeout=timeout, retries=retries)
    except Exception:
        # Fallback para UDP porta 8899 caso Modbus TCP não esteja disponível
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

    power_w = parse_f("total_inverter_power", parse_f("active_power", parse_f("p_grid", parse_f("ppv", 0.0))))
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
            
        elif inv_type in ["goodwe_udp", "goodwe_tcp", "goodwe"]:
            port = inv_cfg.get("port", 502)
            family = inv_cfg.get("family", "DT")
            timeout = inv_cfg.get("timeout", 4)
            retries = inv_cfg.get("retries", 2)
            res = asyncio.run(fetch_goodwe_async(ip, port=port, family=family, timeout=timeout, retries=retries))
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
    """Envia o snapshot de telemetria para o Supabase com suporte a fila offline (Offline-First)."""
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
            flush_offline_queue(supabase_url, headers)
        else:
            print(f" ⚠️ [SUPABASE] Aviso ao sincronizar ({resp.status_code}): {resp.text[:100]}")
            queue_offline_telemetry(payload)
    except Exception as e:
        print(f" ⚠️ [SUPABASE] Sem conexao com a nuvem ({type(e).__name__}). Gravando snapshot na fila offline local...")
        queue_offline_telemetry(payload)

def run_collection_cycle():
    """Executa um ciclo completo de leitura dos 3 inversores e consolida os dados."""
    timestamp = datetime.now().astimezone().isoformat()
    inverters_results = []
    
    total_power_w = 0.0
    total_today_kwh = 0.0
    total_lifetime_kwh = 0.0
    
    print(f"\n=======================================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [TELEMETRIA SOLAR] INICIANDO CICLO DE LEITURA")
    print(f"=======================================================")

    last_known = get_last_known_energies()

    for inv_cfg in config.get("inverters", []):
        if not inv_cfg.get("enabled", True):
            continue
        res = collect_inverter(inv_cfg)
        inv_id = res.get("id")

        # Se o inversor estiver offline (ex: noite/standby), reaproveita o último acumulado válido de hoje
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

    # Salva latest.json com escrita atômica
    try:
        atomic_write_json(LATEST_FILE, plant_summary)
    except Exception as e:
        print(f" ⚠️ [DISCO] Erro ao gravar latest.json: {e}")

    # Atualiza history.json com escrita atômica
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
        
    try:
        atomic_write_json(HISTORY_FILE, history_records)
    except Exception as e:
        print(f" ⚠️ [DISCO] Erro ao gravar history.json: {e}")

    # Sincroniza automaticamente com o Supabase (Nuvem)
    push_to_supabase(plant_summary)

    return plant_summary

# REST API Embutida Thread-Safe
class SolarApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError):
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/latest":
            if os.path.exists(LATEST_FILE):
                try:
                    with open(LATEST_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except Exception:
                    self._send_json({"error": "Erro de leitura do arquivo de telemetria"}, 500)
            else:
                self._send_json({"error": "Nenhum dado coletado ainda"}, 404)
                
        elif self.path == "/api/history":
            if os.path.exists(HISTORY_FILE):
                try:
                    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(data)
                except Exception:
                    self._send_json([])
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
    server = None
    selected_port = port
    for p in [port, port + 1, port + 2]:
        try:
            server = ThreadingHTTPServer(("0.0.0.0", p), SolarApiHandler)
            selected_port = p
            break
        except OSError as e:
            if getattr(e, "errno", None) == 10048 or "Address already in use" in str(e):
                continue
            else:
                print(f" [!] Aviso ao iniciar servidor HTTP na porta {p}: {e}")
                return

    if server:
        print(f" [*] API REST Local iniciada em: http://localhost:{selected_port}/api/latest")
        try:
            server.serve_forever()
        except Exception:
            pass
    else:
        print(f" [!] Aviso: Portas {port} a {port+2} estao ocupadas. Coletor continuara rodando normalmente.")

def main():
    api_port = config.get("api_port", 5000)
    poll_sec = config.get("poll_interval_seconds", 600)
    
    if "--once" in sys.argv:
        run_collection_cycle()
        return

    server_thread = Thread(target=start_http_server, args=(api_port,), daemon=True)
    server_thread.start()
    print(f"[*] Intervalo de coleta configurado: {poll_sec} segundos ({poll_sec/60:.1f} min)")

    try:
        while True:
            try:
                run_collection_cycle()
            except Exception as e:
                print(f" [!] Erro no ciclo de coleta: {e}")
            time.sleep(poll_sec)
    except KeyboardInterrupt:
        print("\n[*] Coletor encerrado com sucesso pelo usuario (Ctrl+C).")
        sys.exit(0)

if __name__ == "__main__":
    main()
