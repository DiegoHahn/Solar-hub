-- Solar Hub: estrutura base do banco (PostgreSQL + JSONB).
-- As políticas de acesso (RLS) ficam em migrations próprias.

-- Telemetria em tempo real: um snapshot da usina a cada ciclo do coletor (10 min)
CREATE TABLE IF NOT EXISTS public.solar_telemetry (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    plant_name TEXT NOT NULL DEFAULT 'Usina Solar (16 kW)',
    total_nominal_capacity_kw NUMERIC NOT NULL DEFAULT 16.0,
    total_power_w NUMERIC NOT NULL,
    total_power_kw NUMERIC NOT NULL,
    total_today_kwh NUMERIC NOT NULL,
    total_lifetime_kwh NUMERIC NOT NULL,
    capacity_factor_pct NUMERIC,
    inverters_count INT NOT NULL DEFAULT 3,
    inverters_data JSONB NOT NULL, -- Leitura de cada inversor: tensões, correntes, strings PV e sensores crus
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_solar_telemetry_recorded_at ON public.solar_telemetry (recorded_at DESC);

COMMENT ON TABLE public.solar_telemetry IS 'Registros históricos e em tempo real da telemetria dos 3 inversores solares';

-- Concessionária (Cooperaliança): faturas, histórico de consumo e créditos de GD por titular
CREATE TABLE IF NOT EXISTS public.utility_data (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    distribuidora TEXT NOT NULL DEFAULT 'Cooperaliança (Içara/SC)',
    titular TEXT NOT NULL,
    cpf TEXT NOT NULL,
    perfil_usuario JSONB,
    tarifa_referencia JSONB,
    unidades_consumidoras JSONB NOT NULL, -- Por UC: faturas de 60 meses, extrato GD I/II e gráfico de 12 meses
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_utility_data_updated_at ON public.utility_data (updated_at DESC);

COMMENT ON TABLE public.utility_data IS 'Registros consolidados de faturas, histórico e saldos de créditos GD da Cooperaliança';

-- Geração diária consolidada por inversor (relatórios dos portais + agregados da telemetria)
CREATE TABLE IF NOT EXISTS public.inverter_daily_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date DATE NOT NULL,
    inverter_id TEXT NOT NULL, -- inv_1..inv_3 ou agregados: plant_total, goodwe_combined
    inverter_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    kwh NUMERIC NOT NULL,
    is_estimated BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'sems_report',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unq_date_inverter UNIQUE (date, inverter_id)
);

COMMENT ON TABLE public.inverter_daily_history IS 'Histórico consolidado de geração diária individual por inversor (GoodWe, Solis)';

-- Geração mensal consolidada por inversor
CREATE TABLE IF NOT EXISTS public.inverter_monthly_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    month TEXT NOT NULL, -- YYYY-MM
    inverter_id TEXT NOT NULL,
    inverter_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    kwh NUMERIC NOT NULL,
    is_estimated BOOLEAN DEFAULT false,
    source TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unq_month_inverter UNIQUE (month, inverter_id)
);

COMMENT ON TABLE public.inverter_monthly_history IS 'Histórico consolidado de geração mensal por inversor';

-- RLS habilitado em todas as tabelas: sem política, nenhum papel além do service_role acessa
ALTER TABLE public.solar_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_daily_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_monthly_history ENABLE ROW LEVEL SECURITY;
