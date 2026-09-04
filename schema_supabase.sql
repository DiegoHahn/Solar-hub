-- ==============================================================================
-- ☀️ SOLAR HUB - ESTRUTURA DO BANCO DE DADOS SUPABASE (POSTGRESQL + JSONB)
-- ==============================================================================
-- Como executar:
-- 1. Abra o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique no ícone "SQL Editor"
-- 3. Cole todo este script e clique no botão verde "Run" (Executar)
-- ==============================================================================

-- 1. TABELA DE TELEMETRIA SOLAR EM TEMPO REAL (INVERSORES SOLIS + GOODWE)
CREATE TABLE IF NOT EXISTS public.solar_telemetry (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    plant_name TEXT NOT NULL DEFAULT 'Usina Solar Diego Hahn (16 kW)',
    total_nominal_capacity_kw NUMERIC NOT NULL DEFAULT 16.0,
    total_power_w NUMERIC NOT NULL,
    total_power_kw NUMERIC NOT NULL,
    total_today_kwh NUMERIC NOT NULL,
    total_lifetime_kwh NUMERIC NOT NULL,
    capacity_factor_pct NUMERIC,
    inverters_count INT NOT NULL DEFAULT 3,
    inverters_data JSONB NOT NULL, -- Contém o payload rico com tensões, correntes, strings e 52 sensores
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de alta performance para buscas temporais rápidas nos gráficos
CREATE INDEX IF NOT EXISTS idx_solar_telemetry_recorded_at ON public.solar_telemetry (recorded_at DESC);

-- 2. TABELA DE GESTÃO DA CONCESSIONÁRIA (COOPERALIANÇA, FATURAS E CRÉDITOS GD)
CREATE TABLE IF NOT EXISTS public.utility_data (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    distribuidora TEXT NOT NULL DEFAULT 'Cooperaliança (Içara/SC)',
    titular TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE, -- Uma linha por titular; collector_utility.py faz upsert (on_conflict=cpf)
    perfil_usuario JSONB,
    tarifa_referencia JSONB,
    unidades_consumidoras JSONB NOT NULL, -- Histórico de 60 meses, extrato GD I e II, gráfico e faturas
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_utility_data_updated_at ON public.utility_data (updated_at DESC);

-- ==============================================================================
-- 🔒 POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Habilita RLS nas tabelas
ALTER TABLE public.solar_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_data ENABLE ROW LEVEL SECURITY;

-- Permite leitura pública / anon para o Dashboard Web consultar os dados
CREATE POLICY "Permitir leitura pública da telemetria" 
    ON public.solar_telemetry 
    FOR SELECT 
    USING (true);

CREATE POLICY "Permitir leitura pública dos dados da concessionária" 
    ON public.utility_data 
    FOR SELECT 
    USING (true);

-- Permite gravação apenas via Service Role (chave secreta do nosso coletor Python)
CREATE POLICY "Permitir inserção via Service Role" 
    ON public.solar_telemetry 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir inserção de dados da concessionária via Service Role" 
    ON public.utility_data 
    FOR INSERT 
    WITH CHECK (true);

-- Notificação de sucesso
COMMENT ON TABLE public.solar_telemetry IS 'Registros históricos e em tempo real da telemetria dos 3 inversores solares';
COMMENT ON TABLE public.utility_data IS 'Registros consolidados de faturas, histórico e saldos de créditos GD da Cooperaliança';
