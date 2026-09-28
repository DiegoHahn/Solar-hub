-- Geração diária medida pela telemetria: o maior acumulado do dia (total_today_kwh) no fuso de Brasília.
-- security_invoker aplica o RLS de solar_telemetry a quem consulta a view (leitura só para autenticados).
CREATE OR REPLACE VIEW public.daily_generation
WITH (security_invoker = true) AS
SELECT
    (recorded_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    max(total_today_kwh) AS kwh
FROM public.solar_telemetry
GROUP BY 1;

COMMENT ON VIEW public.daily_generation IS 'Geração diária (kWh) consolidada a partir da telemetria dos inversores';
