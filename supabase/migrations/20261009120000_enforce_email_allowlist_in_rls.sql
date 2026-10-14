-- Authorization inside the database: every dashboard policy now requires the signed-in user's email
-- to be in public.allowed_users, instead of accepting any authenticated session (USING (true)).
-- Before this migration, any valid Supabase session (e.g. a Google sign-in that the Next.js
-- middleware would reject) could read every table, CPF included, straight from the Data API.
--
-- !!! DEPLOYMENT ORDER !!!
-- After this migration runs, an authenticated user whose email is NOT in public.allowed_users sees
-- zero rows and cannot write the cache/quota tables. The owner must INSERT their email (and the
-- integration/E2E test account, SUPABASE_TEST_EMAIL) into public.allowed_users in the same session
-- as the migration, otherwise the dashboard shows no data. No real email is committed here on purpose:
--
--   BEGIN;
--   -- (contents of this file)
--   INSERT INTO public.allowed_users (email) VALUES ('owner@example.com'), ('test-account@example.com');
--   COMMIT;
--
-- Collectors use the service_role key, which bypasses RLS, so they are not affected.
-- The migration is idempotent: it can be re-run safely.

-- 1. Allowlist table. RLS on and no policy for anon/authenticated: only service_role, the table
--    owner and the SECURITY DEFINER function below can read it.
CREATE TABLE IF NOT EXISTS public.allowed_users (
    email TEXT PRIMARY KEY CHECK (email = lower(btrim(email))),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.allowed_users IS
    'Emails allowed to use the dashboard; checked by public.is_allowed_user() in every RLS policy. Stored lowercase.';

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allowed_users FROM anon, authenticated;

-- 2. Membership check used by the policies. SECURITY DEFINER so it can read allowed_users without
--    granting the table to the caller; empty search_path so nothing can be shadowed.
CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.allowed_users au
        WHERE lower(au.email) = lower(auth.jwt() ->> 'email')
    );
$$;

COMMENT ON FUNCTION public.is_allowed_user() IS
    'True when the email claim of the current JWT is in public.allowed_users';

REVOKE ALL ON FUNCTION public.is_allowed_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_user() TO authenticated, service_role;

-- 3. Read policies. `(SELECT ...)` lets Postgres evaluate the check once per statement, not per row.
--    The daily_generation view is security_invoker, so it inherits the solar_telemetry policy.
DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.solar_telemetry;
DROP POLICY IF EXISTS "Read for allowed users" ON public.solar_telemetry;
CREATE POLICY "Read for allowed users" ON public.solar_telemetry
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));

DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.utility_data;
DROP POLICY IF EXISTS "Read for allowed users" ON public.utility_data;
CREATE POLICY "Read for allowed users" ON public.utility_data
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));

DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.inverter_daily_history;
DROP POLICY IF EXISTS "Read for allowed users" ON public.inverter_daily_history;
CREATE POLICY "Read for allowed users" ON public.inverter_daily_history
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));

DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.inverter_monthly_history;
DROP POLICY IF EXISTS "Read for allowed users" ON public.inverter_monthly_history;
CREATE POLICY "Read for allowed users" ON public.inverter_monthly_history
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));

-- 4. Cache and quota tables written by the dashboard with the user's session
--    (/api/ai-advisor via lib/aiQuota.ts, weather cache via lib/queries.ts saveDailyWeather).
DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.ai_advisor_daily;
DROP POLICY IF EXISTS "Inserção para usuários autenticados" ON public.ai_advisor_daily;
DROP POLICY IF EXISTS "Atualização para usuários autenticados" ON public.ai_advisor_daily;
DROP POLICY IF EXISTS "Read for allowed users" ON public.ai_advisor_daily;
DROP POLICY IF EXISTS "Insert for allowed users" ON public.ai_advisor_daily;
DROP POLICY IF EXISTS "Update for allowed users" ON public.ai_advisor_daily;
CREATE POLICY "Read for allowed users" ON public.ai_advisor_daily
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));
CREATE POLICY "Insert for allowed users" ON public.ai_advisor_daily
    FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_allowed_user()));
CREATE POLICY "Update for allowed users" ON public.ai_advisor_daily
    FOR UPDATE TO authenticated
    USING ((SELECT public.is_allowed_user()))
    WITH CHECK ((SELECT public.is_allowed_user()));

DROP POLICY IF EXISTS "Leitura para usuários autenticados" ON public.daily_weather;
DROP POLICY IF EXISTS "Inserção para usuários autenticados" ON public.daily_weather;
DROP POLICY IF EXISTS "Atualização para usuários autenticados" ON public.daily_weather;
DROP POLICY IF EXISTS "Read for allowed users" ON public.daily_weather;
DROP POLICY IF EXISTS "Insert for allowed users" ON public.daily_weather;
DROP POLICY IF EXISTS "Update for allowed users" ON public.daily_weather;
CREATE POLICY "Read for allowed users" ON public.daily_weather
    FOR SELECT TO authenticated USING ((SELECT public.is_allowed_user()));
CREATE POLICY "Insert for allowed users" ON public.daily_weather
    FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_allowed_user()));
CREATE POLICY "Update for allowed users" ON public.daily_weather
    FOR UPDATE TO authenticated
    USING ((SELECT public.is_allowed_user()))
    WITH CHECK ((SELECT public.is_allowed_user()));

-- 5. Quota RPC: reject non-allowlisted callers explicitly (RLS on ai_advisor_daily would also block
--    the upsert, but failing early gives a clear error). service_role keeps working for maintenance.
CREATE OR REPLACE FUNCTION public.increment_ai_quota(
    p_date DATE,
    p_is_primary BOOLEAN
)
RETURNS TABLE (
    primary_count INT,
    total_calls INT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' AND NOT public.is_allowed_user() THEN
        RAISE EXCEPTION 'user is not allowed to use the AI advisor quota'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    INSERT INTO public.ai_advisor_daily (
        date,
        primary_count,
        total_calls,
        last_call_at
    )
    VALUES (
        p_date,
        CASE WHEN p_is_primary THEN 1 ELSE 0 END,
        1,
        now()
    )
    ON CONFLICT (date) DO UPDATE SET
        total_calls = public.ai_advisor_daily.total_calls + 1,
        primary_count = public.ai_advisor_daily.primary_count + (CASE WHEN p_is_primary THEN 1 ELSE 0 END),
        last_call_at = now()
    RETURNING
        public.ai_advisor_daily.primary_count,
        public.ai_advisor_daily.total_calls;
END;
$$;

COMMENT ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) IS
    'Atomically increments the daily Gemini quota; only for allowlisted users (or service_role)';

REVOKE ALL ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) TO authenticated, service_role;
