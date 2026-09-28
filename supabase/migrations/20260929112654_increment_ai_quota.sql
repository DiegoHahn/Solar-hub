-- Função atômica para incremento da cota diária do Consultor IA.
-- Evita race conditions em chamadas simultâneas.
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

COMMENT ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) IS 'Incrementa a cota diária do Gemini de forma atômica';

REVOKE ALL ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(DATE, BOOLEAN) TO authenticated;
