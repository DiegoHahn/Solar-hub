<div align="center">

# Solar Hub

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Google-Gemini_AI-8E75B2?style=for-the-badge&logo=google)](https://ai.google.dev/)

[Visão Geral](#1-visão-geral) • [Arquitetura](#2-arquitetura-do-sistema) • [Protocolos dos Inversores](#3-protocolos-e-engenharia-reversa-iot) • [Stack Tecnológica](#4-stack-tecnológica) • [Instalação](#6-instalação-e-execução) • [Segurança](#7-segurança-e-autenticação)

</div>

---

## 1. Visão Geral

O **Solar Hub** é uma plataforma de telemetria fotovoltaica e inteligência energética projetada para unificar usinas solares multimarcas (**Solis** + **GoodWe**) e concessionárias de energia em um dashboard analítico unificado em tempo real.

O projeto resolve o problema de fragmentação de dados em usinas com múltiplos inversores de fabricantes distintos, substituindo portais proprietários dispersos por uma **arquitetura Edge-to-Cloud** resiliente, com telemetria direta via rede local, zero dependência de clouds externas para coleta, e análise preditiva com Inteligência Artificial.

### Destaques de Engenharia
* **Coleta Edge 100% Local:** Comunicação direta com os inversores na rede local via Modbus TCP, UDP e Solarman V5 frame parsing.
* **Zero Armazenamento Desnecessário em Disco:** Telemetria em memória com push direto via HTTPS/REST para nuvem, ideal para placas embarcadas (Orange Pi / Raspberry Pi) sem desgaste de armazenamento eMMC/SD.
* **Fila de Tolerância a Falhas:** Buffer offline local caso a internet caia, sincronizando snapshots retroativos assim que a conexão restabelece.
* **Automação Contábil GD:** Scraper/integrador automatizado com a concessionária de energia (**Cooperaliança**), extraindo histórico de faturas de 60 meses, extrato detalhado de créditos GD I e GD II e demonstrativo financeiro.
* **Interface de Alta Fidelidade:** Dashboard em Next.js 16 (App Router + Turbopack), SSR com `@supabase/ssr`, Tailwind CSS, visual Glassmorphism e gráficos interativos com Recharts.
* **Consultor Energético IA:** Módulo de análise inteligente integrado com o **Google Gemini**, avaliando perdas de eficiência, projeção de economia e saúde dos inversores.

---

## 2. Arquitetura do Sistema

```mermaid
flowchart TB
    subgraph Edge["🏠 Edge Layer (Orange Pi 4 Pro / Linux Daemon 24/7)"]
        direction TB
        INV1["☀️ Inversor 1 (Solis 6 kW)\nSolarman V5 Modbus (Porta 8899)"]
        INV2["☀️ Inversor 2 (GoodWe 5 kW)\nModbus TCP / UDP (Porta 502/8899)"]
        INV3["☀️ Inversor 3 (GoodWe 5 kW)\nModbus TCP / UDP (Porta 502/8899)"]

        COLLECTOR["🤖 collector_inverters.py\n(Ciclo 10m · Daemon Systemd · In-Memory)"]
        UTILITY["🏢 collector_utility.py\n(Cron Diário 21h · JWT Concessionária)"]
        RETRY_QUEUE[("📦 Fila Offline\n(Buffer Transitório)")]

        INV1 -->|Holding Regs 0..39| COLLECTOR
        INV2 -->|52 Sensores Modbus| COLLECTOR
        INV3 -->|52 Sensores Modbus| COLLECTOR

        COLLECTOR --> RETRY_QUEUE
    end

    subgraph Cloud["☁️ Cloud Layer (Supabase Serverless)"]
        POSTGRES[("🐘 PostgreSQL Engine\nRow Level Security")]
        TABLE_TEL["📊 solar_telemetry\n(Snapshot 10m + JSONB Inversores)"]
        TABLE_UTL["📑 utility_data\n(60 Meses Faturas + Extrato GD)"]
        AUTH["🔐 Supabase Auth\n(PKCE + JWT SSR Sessions)"]

        POSTGRES --> TABLE_TEL
        POSTGRES --> TABLE_UTL
    end

    subgraph External["🏢 Serviços Externos"]
        COOP_API["⚡ API Concessionária\n(Useall / Cooperaliança)"]
        OPEN_METEO["⛅ Open-Meteo API\n(Radiação Solar & Tempo)"]
        GEMINI["🧠 Google Gemini AI\n(Consultoria Energética)"]
    end

    subgraph Frontend["🌐 Web App (Next.js 16 + Vercel)"]
        DASH["📱 Portal Solar Hub\n(/, /placas, /combinada, /cooperativa)"]
        PROXY["🛡️ Route Proxy SSR\n(Sessões & RBAC)"]
    end

    COLLECTOR -->|HTTPS REST| TABLE_TEL
    UTILITY -->|HTTPS REST| TABLE_UTL
    UTILITY -.->|Coleta Faturas & GD| COOP_API
    DASH -.-> OPEN_METEO
    DASH -.-> GEMINI
    PROXY --> DASH
    AUTH --> PROXY
    TABLE_TEL --> DASH
    TABLE_UTL --> DASH
```

---

## 3. Protocolos e Engenharia Reversa IoT

O sistema interroga 3 inversores simultaneamente na rede local em menos de 2 segundos, mantendo isolamento completo entre as telemetrias:

| Inversor | Potência | Interface Física | Protocolo de Telemetria | Parâmetros Extraídos |
| :--- | :--- | :--- | :--- | :--- |
| **Solis / Ginlong** | ~6.0 kW | Datalogger Solarman LSW-3 (IP Local) | **Solarman V5 Frame Parser** (Porta `8899`) + Fallback HTTP Status | Potência ativa (W), Tensão da Rede CA (V), Corrente CA (A), Freq (Hz), Strings PV1/PV2 (V, A, W), Temp. Interna (°C), Acumulado Hoje e Total (kWh), Wi-Fi RSSI. |
| **GoodWe** | 5.0 kW | Módulo Wi-Fi GoodWe DNS (IP Local) | **Modbus TCP** (Porta `502`) com Fallback UDP (Porta `8899`) | 52 registradores elétricos: Potência Ativa, Aparente e Reativa, Fator de Potência (FP), Temp. Interna e Dissipador Térmico (°C), Horas de Operação, Vbus, Strings PV1/PV2. |

### Decodificação Modbus Solarman V5 (Solis):
O coletor empacota quadros Modbus RTU encapsulados em cabeçalhos proprietários Solarman V5 (`0xA5`), lendo os registradores de retenção (*holding registers* `0..39`):
* `Reg[06]`: Tensão da String PV1 (fator `0.1 V`)
* `Reg[07]`: Corrente da String PV1 (fator `0.01 A`)
* `Reg[08]`: Tensão da String PV2 (fator `0.1 V`)
* `Reg[09]`: Corrente da String PV2 (fator `0.01 A`)
* `Reg[14]`: Frequência da Rede Elétrica (fator `0.01 Hz`)
* `Reg[15]`: Tensão da Rede Elétrica CA (fator `0.1 V`)
* `Reg[16]`: Corrente da Rede Elétrica CA (fator `0.01 A`)
* `Reg[25]`: Energia Gerada Hoje (fator `0.01 kWh`)
* `Reg[36]`: Temperatura Interna do Inversor (fator `0.1 °C`)

---

## 4. Stack Tecnológica

### Core & Frontend
* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19, TypeScript).
* **Estilização:** [Tailwind CSS](https://tailwindcss.com/) com paleta HSL balanceada, modo escuro nativo e estética Glassmorphism.
* **Visualização de Dados:** [Recharts](https://recharts.org/) com interpolação monotônica, curvas empilhadas, tooltips responsivos e comparativos históricos.
* **Componentes & Primitivas:** Radix UI, Tremor primitives e Remix Icons.
* **IA Generativa:** Modelos Gemini.

### Backend, IoT & Edge
* **Linguagem Edge:** Python 3.10+.
* **Bibliotecas IoT:** `pysolarmanv5`, `goodwe`, `requests`, `urllib3`.
* **Serviço do Sistema:** Daemons nativos `systemd` no Linux com auto-restart e temporizadores cron.
* **Hardware Edge:** Orange Pi 4 Pro (SoC Octa-core ARM64, consumo ~4W) operando 24 horas por dia.

### Nuvem & Banco de Dados
* **Banco de Dados:** [Supabase](https://supabase.com/) PostgreSQL 15 com colunas estruturadas e `JSONB` flexível para séries de sensores.
* **Segurança de Acesso:** Row Level Security (RLS) e autenticação segura com `@supabase/ssr` e Next.js 16 Route Proxy.

---

## 5. Estrutura do Repositório

```text
├── collector_inverters.py          # Coletor de telemetria dos 3 inversores (Modbus/V5/TCP/UDP)
├── collector_utility.py            # Coletor de faturas e extratos de GD da concessionária
├── config.json                     # Mapeamento de IPs, portas, Seriais e topologia dos inversores
├── requirements.txt                # Dependências Python dos coletores
├── run_inverters.sh / .bat         # Scripts de inicialização do coletor em background
├── run_utility.sh / .bat           # Scripts de sincronização contábil
├── solar-inverters.service         # Unidade Systemd para execução 24/7 em Linux embarcado
├── schema_supabase.sql             # Definição DDL do PostgreSQL, tabelas e políticas RLS
└── dashboard/                      # Aplicação Web Next.js 16
    ├── src/
    │   ├── app/                    # Rotas: /, /placas, /combinada, /cooperativa, /login
    │   ├── components/             # InverterCard, Gauge, Charts, Nav, AppShell
    │   ├── lib/                    # Supabase SSR client/server, queries, weather, types
    │   └── proxy.ts                # Next.js 16 Proxy de autenticação e proteção de rotas
    ├── tailwind.config.ts          # Design system e tokens de cores
    └── package.json
```

---

## 6. Instalação e Execução

### Pré-requisitos
* Python 3.10+ (para os coletores)
* Node.js 20+ (para o dashboard)
* Projeto no Supabase configurado com o script `schema_supabase.sql`

### 1. Configurando os Coletores IoT (Edge)
```bash
# Clone o repositório
git clone https://github.com/DiegoHahn/Solar-hub.git
cd Solar-hub

# Crie e ative o ambiente virtual
python3 -m venv .venv
source .venv/bin/activate  # No Windows: .venv\Scripts\activate

# Instale as dependências
pip install -r requirements.txt

# Configure as credenciais no .env (baseado em .env.example)
cp .env.example .env
```

Execute uma coleta de teste para validar a comunicação na rede:
```bash
python3 collector_inverters.py --once
```

Para rodar em regime permanente (24/7) no Linux / Orange Pi / Raspberry Pi:
```bash
sudo cp solar-inverters.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now solar-inverters.service
```

### 2. Configurando o Dashboard Web
```bash
cd dashboard

# Instale as dependências
npm install

# Configure o arquivo de ambiente
cp .env.example .env.local

# Inicie o servidor de desenvolvimento
npm run dev
```
Acesse no navegador: **`http://localhost:3000`**

---

## 7. Segurança e Autenticação

* **Zero Exposição de Chaves Sensíveis:** Arquivos `.env` e `.env.local` são estritamente excluídos do controle de versão pelo `.gitignore`.
* **Controle de Acesso Baseado em Sessão (RBAC):** Proteção de rotas em tempo de execução via `@supabase/ssr` e Next.js 16 Proxy. Usuários não autenticados são redirecionados automaticamente para a tela de login (`/login`).
* **Segurança no Banco (RLS):** As tabelas `solar_telemetry` e `utility_data` possuem políticas RLS no Postgres, permitindo escrita exclusivamente via `service_role` (coletores locais autenticados) e leitura apenas para usuários autorizados.
* **Comunicação Segura:** Todas as trocas de telemetria e faturas para a nuvem utilizam TLS/HTTPS com criptografia de ponta a ponta.

---

## Licença

Distribuído sob a licença **MIT**. Veja `LICENSE` para mais informações.
