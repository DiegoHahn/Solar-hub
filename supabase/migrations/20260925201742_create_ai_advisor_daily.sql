-- Estado diário do Consultor IA: contadores de cota do Gemini e a análise gerada no dia (cache).
-- Gravado pela rota /api/ai-advisor do dashboard com a sessão do usuário autenticado.
CREATE TABLE IF NOT EXISTS public.ai_advisor_daily (
    date DATE PRIMARY KEY, -- dia no fuso America/Sao_Paulo
    primary_count INT NOT NULL DEFAULT 0, -- chamadas ao modelo primário (GEMINI_MODEL)
    total_calls INT NOT NULL DEFAULT 0,
    last_call_at TIMESTAMPTZ,
    model_used TEXT,
    analysis JSONB, -- AdvisorResult { daily, monthly }
    analysis_updated_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ai_advisor_daily IS 'Cota diária do Gemini e cache da análise do Consultor IA';

ALTER TABLE public.ai_advisor_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura para usuários autenticados" ON public.ai_advisor_daily
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserção para usuários autenticados" ON public.ai_advisor_daily
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualização para usuários autenticados" ON public.ai_advisor_daily
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
