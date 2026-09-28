-- Clima diário da localização da usina (Open-Meteo), guardado com os valores brutos da API.
-- Condição, ícone e horas de sol pleno são derivados na leitura pelo dashboard.
-- Os últimos dias são reescritos a cada atualização (previsão -> observado); os mais antigos ficam como definitivos.
CREATE TABLE IF NOT EXISTS public.daily_weather (
    date DATE PRIMARY KEY, -- dia no fuso America/Sao_Paulo
    weather_code INT NOT NULL, -- código WMO
    temperature_max_c NUMERIC NOT NULL,
    temperature_min_c NUMERIC NOT NULL,
    sunshine_duration_s NUMERIC NOT NULL, -- segundos de sol no dia
    shortwave_radiation_mj NUMERIC NOT NULL, -- irradiação horizontal (MJ/m²)
    precipitation_mm NUMERIC NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('forecast', 'archive')), -- endpoint da Open-Meteo de origem
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.daily_weather IS 'Clima diário da usina (Open-Meteo): cache de forecast/archive usado no gráfico Sol vs Geração';

ALTER TABLE public.daily_weather ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura para usuários autenticados" ON public.daily_weather
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserção para usuários autenticados" ON public.daily_weather
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualização para usuários autenticados" ON public.daily_weather
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
