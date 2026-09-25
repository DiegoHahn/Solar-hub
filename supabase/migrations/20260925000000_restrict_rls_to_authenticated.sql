-- Acesso aos dados: leitura apenas para usuários autenticados no dashboard.
-- A escrita é feita exclusivamente pelos coletores com a service_role key, que ignora RLS,
-- por isso nenhuma política de INSERT/UPDATE/DELETE é concedida aos demais papéis.

DROP POLICY IF EXISTS "Permitir leitura pública da telemetria" ON public.solar_telemetry;
DROP POLICY IF EXISTS "Permitir inserção via Service Role" ON public.solar_telemetry;
DROP POLICY IF EXISTS "Permitir leitura pública dos dados da concessionária" ON public.utility_data;
DROP POLICY IF EXISTS "Permitir inserção de dados da concessionária via Service Role" ON public.utility_data;
DROP POLICY IF EXISTS "Permitir leitura pública do histórico" ON public.inverter_daily_history;
DROP POLICY IF EXISTS "Permitir inserção e atualização via service role" ON public.inverter_daily_history;
DROP POLICY IF EXISTS "Allow public read inverter_monthly_history" ON public.inverter_monthly_history;
DROP POLICY IF EXISTS "Allow service_role write inverter_monthly_history" ON public.inverter_monthly_history;

CREATE POLICY "Leitura para usuários autenticados" ON public.solar_telemetry
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Leitura para usuários autenticados" ON public.utility_data
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Leitura para usuários autenticados" ON public.inverter_daily_history
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Leitura para usuários autenticados" ON public.inverter_monthly_history
    FOR SELECT TO authenticated USING (true);
