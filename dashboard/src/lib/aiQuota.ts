import { createClient } from "@/lib/supabase/server";

export interface QuotaState {
  date: string; // YYYY-MM-DD (fuso de Brasília)
  primary_count: number; // chamadas ao modelo primário configurado em GEMINI_MODEL
  total_calls: number;
}

export interface CachedAdvisorData {
  updatedAt: string;
  modelUsed: string;
  data: AdvisorResult;
}

export interface AdvisorResult {
  daily: {
    summary: string;
    recommendations: Array<{
      title: string;
      description: string;
      icon: "flashlight" | "temp" | "compass" | "shield" | "dollar" | "tools" | string;
    }>;
  };
  monthly: {
    summary: string;
    recommendations: Array<{
      title: string;
      description: string;
      icon: "flashlight" | "temp" | "compass" | "shield" | "dollar" | "tools" | string;
    }>;
  };
}

export const fallbackAdvisorAnalysis: AdvisorResult = {
  daily: {
    summary:
      "A produção da usina refletiu diretamente as condições atmosféricas do dia em Içara/SC. A irradiação solar captada pelos módulos supriu as cargas essenciais da residência e direcionou o superávit para a rede da Cooperaliança, mantendo a operação equilibrada frente ao potencial nominal de 16 kWp.",
    recommendations: [
      {
        title: "Aproveitamento Solar",
        description:
          "Concentre o uso de equipamentos de maior potência nas horas de maior radiação solar diurna para maximizar a autossuficiência.",
        icon: "flashlight",
      },
      {
        title: "Injeção e Compensação",
        description:
          "O excedente gerado é injetado na Cooperaliança e fica registrado para compensar o consumo noturno.",
        icon: "dollar",
      },
      {
        title: "Status Operacional",
        description:
          "Os três inversores operaram com estabilidade técnica e sem anomalias de rede.",
        icon: "tools",
      },
    ],
  },
  monthly: {
    summary:
      "O balanço energético mensal mantém solidez patrimonial, sustentado por um estoque de créditos expressivo junto à Cooperaliança (superior a 9.000 kWh). Essa reserva estratégica garante segurança energética e estabilidade financeira completa para períodos de menor incidência solar.",
    recommendations: [
      {
        title: "Reserva Estratégica GD",
        description:
          "O saldo de créditos na Cooperaliança assegura ampla cobertura para o consumo nos meses de menor insolação.",
        icon: "shield",
      },
      {
        title: "Retorno Financeiro",
        description:
          "A autossuficiência da usina proporciona abatimento contínuo e expressivo na despesa mensal de energia.",
        icon: "dollar",
      },
      {
        title: "Manutenção Preventiva",
        description:
          "A inspeção visual periódica dos módulos preserva a máxima capacidade de captação e geração.",
        icon: "tools",
      },
    ],
  },
};

const TABLE = "ai_advisor_daily";

/** Retorna a data atual no fuso horário de Brasília (YYYY-MM-DD) */
export function getBrasiliaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Verifica se o modelo usado corresponde ao modelo primário (aceita variações de sufixo/versão). */
export function isPrimaryModel(modelUsed: string, primaryModel: string): boolean {
  const used = modelUsed.trim().toLowerCase();
  const primary = primaryModel.trim().toLowerCase();
  return used === primary || used.includes(primary) || primary.includes(used);
}

/** Lê a cota do dia; sem registro (ou em caso de erro) considera a cota zerada. */
export async function getQuotaState(): Promise<QuotaState> {
  const date = getBrasiliaDate();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("primary_count, total_calls")
    .eq("date", date)
    .maybeSingle();

  if (error) console.error("Erro ao ler cota do Consultor IA:", error);
  return { date, primary_count: data?.primary_count ?? 0, total_calls: data?.total_calls ?? 0 };
}

/** Registra uma chamada bem-sucedida ao Gemini e retorna a cota atualizada. */
export async function incrementQuota(modelUsed: string): Promise<QuotaState> {
  const date = getBrasiliaDate();
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const isPrimary = isPrimaryModel(modelUsed, primaryModel);

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("increment_ai_quota", {
      p_date: date,
      p_is_primary: isPrimary,
    })
    .maybeSingle();

  if (error) {
    console.error("Erro ao incrementar cota via RPC, aplicando fallback:", error);
    const current = await getQuotaState();
    const next: QuotaState = {
      date,
      total_calls: current.total_calls + 1,
      primary_count: current.primary_count + (isPrimary ? 1 : 0),
    };
    await supabase
      .from(TABLE)
      .upsert({ ...next, last_call_at: new Date().toISOString() }, { onConflict: "date" });
    return next;
  }

  const row = data as { primary_count: number; total_calls: number } | null;
  return {
    date,
    primary_count: row?.primary_count ?? 1,
    total_calls: row?.total_calls ?? 1,
  };
}

/** Lê a análise gerada hoje, se houver. */
export async function getAdvisorCache(): Promise<CachedAdvisorData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("analysis, model_used, analysis_updated_at")
    .eq("date", getBrasiliaDate())
    .maybeSingle();

  if (error) {
    console.error("Erro ao ler cache do Consultor IA:", error);
    return null;
  }
  if (!data?.analysis) return null;

  return {
    data: data.analysis as AdvisorResult,
    modelUsed: data.model_used ?? "",
    updatedAt: data.analysis_updated_at ?? "",
  };
}

/** Salva a análise gerada como cache do dia. */
export async function saveAdvisorCache(data: AdvisorResult, modelUsed: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      date: getBrasiliaDate(),
      analysis: data,
      model_used: modelUsed,
      analysis_updated_at: new Date().toISOString(),
    },
    { onConflict: "date" },
  );
  if (error) console.error("Erro ao salvar cache do Consultor IA:", error);
}
