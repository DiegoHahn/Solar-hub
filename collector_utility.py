import os
import sys
import json
import time
import requests
from datetime import datetime

# Garante suporte a UTF-8 no terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

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

API_BASE = "https://portal.cooperalianca.com.br/agenciavirtual3bff/api/"
TOKEN_EXTERNO = ENV.get("COOPERALIANCA_TOKEN_EXTERNO", "")

def push_utility_to_supabase(result):
    """Envia o snapshot da Cooperaliança para o Supabase (Nuvem)."""
    supabase_url = ENV.get("SUPABASE_URL")
    service_key = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return

    payload = {
        "updated_at": result.get("timestamp"),
        "distribuidora": result.get("distribuidora", "Cooperaliança (Içara/SC)"),
        "titular": result.get("titular", "TITULAR"),
        "cpf": result.get("cpf", "00000000000"),
        "perfil_usuario": result.get("perfil_usuario", {}),
        "tarifa_referencia": result.get("tarifa_referencia", {}),
        "unidades_consumidoras": result.get("unidades_consumidoras", {})
    }
    
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    try:
        resp = requests.post(f"{supabase_url}/rest/v1/utility_data?on_conflict=cpf", headers=headers, json=payload, timeout=12)
        if resp.status_code in [200, 201]:
            print(f" ☁️ [SUPABASE] Dados da Cooperaliança sincronizados na nuvem com sucesso! (Status {resp.status_code})")
        else:
            print(f" ⚠️ [SUPABASE] Aviso ao sincronizar concessionária: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f" ⚠️ [SUPABASE] Erro de rede ao sincronizar concessionária: {e}")

def sync_cooperalianca(cpf=None, senha=None):
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "use-token-externo": TOKEN_EXTERNO,
        "Origin": "https://portal.cooperalianca.com.br",
        "Referer": "https://portal.cooperalianca.com.br/agenciavirtual/"
    }

    print(f"\n=======================================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [COOPERALIANCA] INICIANDO SINCRONIZACAO (USEALL API)")
    print(f"=======================================================")

    # 1. Login
    payload = {
        "EmailInscricao": cpf.replace(".", "").replace("-", ""),
        "Senha": senha,
        "CorTema": "#003b6d"
    }

    resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=12)
    if resp.status_code != 200:
        raise Exception(f"Falha na autenticacao: {resp.status_code} - {resp.text}")

    auth_data = resp.json()
    token = auth_data.get("Content", {}).get("Token")
    if not token:
        raise Exception("Token nao retornado pela API da Cooperalianca")

    headers["Authorization"] = f"Bearer {token}"
    print(f" -> Autenticacao efetuada com sucesso! Titular: {auth_data.get('Content', {}).get('Nome', 'Titular')}")

    # 2. Perfil do Usuario
    r_user = requests.get(API_BASE + "PerfilUsuario/BuscarPerfilUsuario?codigoUc=1000000001", headers=headers, timeout=10)
    perfil_usuario = r_user.json().get("Content", {}) if r_user.status_code == 200 else {}

    ucs = ["1000000001", "1000000002", "1000000003"]
    result = {
        "timestamp": datetime.now().isoformat(),
        "distribuidora": "Cooperaliança (Içara/SC)",
        "titular": auth_data.get("Content", {}).get("Nome", "TITULAR"),
        "cpf": cpf,
        "perfil_usuario": perfil_usuario,
        "tarifa_referencia": {
            "classe": "RURAL",
            "subclasse": "AGROPECUARIA URBANA",
            "tipo_rede": "Trifásico",
            "bandeira_vigente": "Bandeira amarela",
            "tarifa_kwh": 0.77658,
            "tusd_kwh": 0.49944,
            "te_kwh": 0.27714,
            "icms_aliquota": 17.0
        },
        "unidades_consumidoras": {}
    }

    for uc in ucs:
        uc_data = {"codigo_uc": uc}
        
        # A. Historico de 60 meses de faturas e consumo
        r_hist = requests.get(API_BASE + f"Fatura/RecuperarHistoricoFaturaConsumo60Meses?codigoUc={uc}", headers=headers, timeout=10)
        if r_hist.status_code == 200:
            uc_data["historico_faturas_60_meses"] = r_hist.json().get("Content", [])

        # B. Resumo da ultima fatura
        r_res = requests.get(API_BASE + f"ImprimirFaturas/RecuperarResumoUltimaFaturaUc?codigoUc={uc}", headers=headers, timeout=10)
        if r_res.status_code == 200:
            uc_data["resumo_ultima_fatura"] = r_res.json().get("Content", {})

        # C. Dados Gerais de Geracao Distribuida
        r_gd = requests.get(API_BASE + f"GeracaoDistribuida/RecuperarDadosGeracaoDistribuida?codigoUc={uc}", headers=headers, timeout=10)
        if r_gd.status_code == 200:
            uc_data["geracao_distribuida"] = r_gd.json().get("Content", {})

        # D. Extrato completo de GD (Creditos / Compensacoes)
        r_gd_hist = requests.get(API_BASE + f"GeracaoDistribuida/RecuperarDadosHistoricoGeracao?codigoUc={uc}", headers=headers, timeout=10)
        if r_gd_hist.status_code == 200:
            uc_data["extrato_historico_gd"] = r_gd_hist.json().get("Content", {})

        # E. Grafico de 12 meses de Injecao x Consumo x Saldo
        r_gd_chart = requests.get(API_BASE + f"GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo?codigoUc={uc}", headers=headers, timeout=10)
        if r_gd_chart.status_code == 200:
            uc_data["grafico_historico_12_meses"] = r_gd_chart.json().get("Content", {})
            
        result["unidades_consumidoras"][uc] = uc_data
        
        # Log detalhado de cada UC
        gd_info = uc_data.get("geracao_distribuida", {})
        saldo = gd_info.get("ValorProximoSaldoVencer", 0.0)
        pot = gd_info.get("PotenciaInstalada", 0.0)
        faturas_count = len(uc_data.get("historico_faturas_60_meses", []))
        
        gd_tag = f" | Usina: {pot:.0f} kW | Saldo GD: {saldo:,.0f} kWh" if pot > 0 else ""
        print(f" -> UC {uc}: {faturas_count} faturas no historico{gd_tag}")

    # Salva no disco
    out_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "cooperalianca_latest.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"-------------------------------------------------------")
    print(f" Dados salvos localmente em: {out_path}")
    print(f"=======================================================")

    # Envia automaticamente para a nuvem no Supabase
    push_utility_to_supabase(result)

    return result

def download_informativo_pdf(competencia="01/02/2026 00:00:00", uc=1000000001, cpf=None, senha=None, output_file="data/informativo_microgeracao.pdf"):
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "use-token-externo": TOKEN_EXTERNO,
        "Origin": "https://portal.cooperalianca.com.br",
        "Referer": "https://portal.cooperalianca.com.br/agenciavirtual/"
    }
    payload = {"EmailInscricao": cpf.replace(".", "").replace("-", ""), "Senha": senha, "CorTema": "#003b6d"}
    resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=10)
    token = resp.json().get("Content", {}).get("Token")
    headers["Authorization"] = f"Bearer {token}"

    pdf_payload = {"CodigoUc": int(uc), "AnoMes": competencia, "NovoInformativo": "S"}
    r_pdf = requests.post(API_BASE + "GeracaoDistribuida/InformativoMicrogeracao", headers=headers, json=pdf_payload, timeout=15)
    if r_pdf.status_code == 200:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "wb") as f:
            f.write(r_pdf.content)
        print(f" PDF oficial da microgeracao salvo em: {output_file}")
        return output_file
    else:
        raise Exception(f"Erro ao baixar PDF: {r_pdf.status_code} - {r_pdf.text}")

def main():
    sync_cooperalianca()
    
    if "--pdf" in sys.argv:
        try:
            download_informativo_pdf()
        except Exception as e:
            print(f"Aviso ao baixar PDF: {e}")

    if "--loop" in sys.argv:
        while True:
            time.sleep(86400)
            try:
                sync_cooperalianca()
            except Exception as e:
                print(f"Erro na sincronizacao periodica: {e}")

if __name__ == "__main__":
    main()
