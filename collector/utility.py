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
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Unidades consumidoras do titular; a primeira é a UC geradora (onde a usina está instalada)
UCS = [uc.strip() for uc in ENV.get("COOPERALIANCA_UCS", "").split(",") if uc.strip()]

def push_utility_to_supabase(result):
    """Envia o snapshot da Cooperaliança para o Supabase (Nuvem)."""
    supabase_url = ENV.get("SUPABASE_URL")
    service_key = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "SEU_PROJECT_REF" in supabase_url:
        return

    payload = {
        "updated_at": result.get("timestamp"),
        "distribuidora": result.get("distribuidora", "Cooperaliança (Içara/SC)"),
        "titular": result["titular"],
        "cpf": result["cpf"],
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
            print(f" ⚠️ [SUPABASE] Aviso ao sincronizar concessionária (Status {resp.status_code})")
    except Exception as e:
        print(f" ⚠️ [SUPABASE] Erro de rede ao sincronizar concessionária: {e}")

def atomic_write_json(filepath, data):
    """Grava JSON de forma atômica usando arquivo temporário para evitar corrupção."""
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

def safe_api_get(url, headers, timeout=12, default=None):
    """Executa requisição GET protegida contra falhas individuais de endpoint."""
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.json().get("Content", default)
        else:
            endpoint_name = url.split('?')[0].split('/')[-1]
            print(f"    ⚠️ Endpoint {endpoint_name} retornou status {r.status_code}")
    except Exception as e:
        endpoint_name = url.split('?')[0].split('/')[-1]
        print(f"    ⚠️ Falha de rede ao consultar {endpoint_name}: {e}")
    return default

def sync_cooperalianca(cpf=None, senha=None):
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")

    if not cpf or not senha:
        print(" ❌ [COOPERALIANCA] CPF ou Senha não configurados no arquivo .env.")
        return None
    if not UCS:
        print(" ❌ [COOPERALIANCA] COOPERALIANCA_UCS não configurado no arquivo .env.")
        return None

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

    try:
        resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=14)
    except Exception as e:
        print(f" ❌ [COOPERALIANCA] Erro de conexao com o servidor da Cooperalianca: {e}")
        return None

    if resp.status_code in [401, 403]:
        print(f" ❌ [COOPERALIANCA] Falha de autenticacao ({resp.status_code}). Verifique se o COOPERALIANCA_TOKEN_EXTERNO no .env expirou.")
        return None
    elif resp.status_code != 200:
        print(f" ❌ [COOPERALIANCA] Falha ao autenticar (Status {resp.status_code})")
        return None

    auth_data = resp.json()
    token = auth_data.get("Content", {}).get("Token")
    if not token:
        print(" ❌ [COOPERALIANCA] Token JWT nao retornado na resposta da autenticacao.")
        return None

    headers["Authorization"] = f"Bearer {token}"
    titular_nome = auth_data.get("Content", {}).get("Nome", "")
    print(f" -> Autenticacao efetuada com sucesso! Titular: {titular_nome}")

    # 2. Perfil do Usuario
    perfil_usuario = safe_api_get(API_BASE + f"PerfilUsuario/BuscarPerfilUsuario?codigoUc={UCS[0]}", headers=headers, default={})

    result = {
        "timestamp": datetime.now().isoformat(),
        "distribuidora": "Cooperaliança (Içara/SC)",
        "titular": titular_nome,
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

    for uc in UCS:
        uc_data = {"codigo_uc": uc}
        
        # A. Historico de 60 meses de faturas e consumo
        uc_data["historico_faturas_60_meses"] = safe_api_get(
            API_BASE + f"Fatura/RecuperarHistoricoFaturaConsumo60Meses?codigoUc={uc}", headers, default=[]
        )

        # B. Resumo da ultima fatura
        uc_data["resumo_ultima_fatura"] = safe_api_get(
            API_BASE + f"ImprimirFaturas/RecuperarResumoUltimaFaturaUc?codigoUc={uc}", headers, default={}
        )

        # C. Dados Gerais de Geracao Distribuida
        uc_data["geracao_distribuida"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/RecuperarDadosGeracaoDistribuida?codigoUc={uc}", headers, default={}
        )

        # D. Extrato completo de GD (Creditos / Compensacoes)
        uc_data["extrato_historico_gd"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/RecuperarDadosHistoricoGeracao?codigoUc={uc}", headers, default={}
        )

        # E. Grafico de 12 meses de Injecao x Consumo x Saldo
        uc_data["grafico_historico_12_meses"] = safe_api_get(
            API_BASE + f"GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo?codigoUc={uc}", headers, default={}
        )
            
        result["unidades_consumidoras"][uc] = uc_data
        
        # Log detalhado de cada UC
        gd_info = uc_data.get("geracao_distribuida") or {}
        saldo = gd_info.get("ValorProximoSaldoVencer", 0.0) or 0.0
        pot = gd_info.get("PotenciaInstalada", 0.0) or 0.0
        faturas_count = len(uc_data.get("historico_faturas_60_meses") or [])
        
        gd_tag = f" | Usina: {pot:.0f} kW | Saldo GD: {saldo:,.0f} kWh" if pot > 0 else ""
        print(f" -> UC {uc}: {faturas_count} faturas no historico{gd_tag}")

    # Salva no disco apenas se explicitamente solicitado via --save-local
    if "--save-local" in sys.argv:
        out_path = os.path.join(DATA_DIR, "cooperalianca_latest.json")
        try:
            atomic_write_json(out_path, result)
            print(f"-------------------------------------------------------")
            print(f" Dados salvos localmente em: {out_path}")
            print(f"=======================================================")
        except Exception as e:
            print(f" ⚠️ [DISCO] Erro ao salvar cooperalianca_latest.json: {e}")

    # Envia automaticamente para a nuvem no Supabase
    push_utility_to_supabase(result)

    return result

def download_informativo_pdf(competencia=None, uc=None, cpf=None, senha=None, output_file=None, data_payload=None):
    cpf = cpf or ENV.get("COOPERALIANCA_CPF")
    senha = senha or ENV.get("COOPERALIANCA_SENHA")
    uc = uc or (UCS[0] if UCS else None)
    output_file = output_file or os.path.join(DATA_DIR, "informativo_microgeracao.pdf")

    if not cpf or not senha or not uc:
        print(" ❌ [PDF] CPF, Senha ou UC ausentes para download do informativo.")
        return None

    # Se a competência não for informada, busca a competência mais recente disponível no payload ou arquivo local
    if not competencia:
        uc_info = (data_payload or {}).get("unidades_consumidoras", {}).get(str(uc), {})
        if not uc_info:
            latest_file = os.path.join(DATA_DIR, "cooperalianca_latest.json")
            if os.path.exists(latest_file):
                try:
                    with open(latest_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    uc_info = data.get("unidades_consumidoras", {}).get(str(uc), {})
                except Exception:
                    pass
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
        "Referer": "https://portal.cooperalianca.com.br/agenciavirtual/"
    }
    payload = {"EmailInscricao": cpf.replace(".", "").replace("-", ""), "Senha": senha, "CorTema": "#003b6d"}
    
    try:
        resp = requests.post(API_BASE + "Auth", headers=headers, json=payload, timeout=12)
        if resp.status_code != 200:
            print(f" ⚠️ [PDF] Falha na autenticacao para download do PDF: {resp.status_code}")
            return None
        token = resp.json().get("Content", {}).get("Token")
        if not token:
            print(" ⚠️ [PDF] Token nao obtido para download do PDF.")
            return None
        headers["Authorization"] = f"Bearer {token}"

        pdf_payload = {"CodigoUc": int(uc), "AnoMes": competencia, "NovoInformativo": "S"}
        r_pdf = requests.post(API_BASE + "GeracaoDistribuida/InformativoMicrogeracao", headers=headers, json=pdf_payload, timeout=15)
        if r_pdf.status_code == 200:
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "wb") as f:
                f.write(r_pdf.content)
            print(f" PDF oficial da microgeracao ({competencia[:10]}) salvo em: {output_file}")
            return output_file
        else:
            print(f" ⚠️ [PDF] Aviso ao baixar informativo de microgeracao ({r_pdf.status_code}): {r_pdf.text[:100]}")
            return None
    except Exception as e:
        print(f" ⚠️ [PDF] Erro de rede ao baixar PDF: {e}")
        return None

def main():
    sync_result = sync_cooperalianca()
    
    if "--pdf" in sys.argv:
        try:
            download_informativo_pdf(data_payload=sync_result)
        except Exception as e:
            print(f" [!] Aviso ao processar PDF: {e}")

    if "--loop" in sys.argv:
        print("\n[*] Sincronizador periodico iniciado (intervalo de 24 horas). Pressione Ctrl+C para sair.")
        try:
            while True:
                time.sleep(86400)
                try:
                    sync_cooperalianca()
                except Exception as e:
                    print(f" [!] Erro na sincronizacao periodica: {e}")
        except KeyboardInterrupt:
            print("\n[*] Sincronizador encerrado pelo usuario (Ctrl+C).")
            sys.exit(0)

if __name__ == "__main__":
    main()
