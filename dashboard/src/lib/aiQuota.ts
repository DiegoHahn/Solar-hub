import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import type { Locale } from "@/i18n";

export interface QuotaState {
  date: string; // YYYY-MM-DD (Brasília timezone)
  primary_count: number; // calls to primary model configured in GEMINI_MODEL
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

const fallbackAnalysisPtBR: AdvisorResult = {
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

const fallbackAnalysisEn: AdvisorResult = {
  daily: {
    summary:
      "Plant output followed the day's weather in Içara/SC. The solar irradiation captured by the modules covered the home's essential loads and sent the surplus to the Cooperaliança grid, keeping operation balanced against the 16 kWp nominal capacity.",
    recommendations: [
      {
        title: "Make the Most of the Sun",
        description:
          "Run high-power appliances during the hours of strongest sunlight to maximize self-sufficiency.",
        icon: "flashlight",
      },
      {
        title: "Injection and Offsetting",
        description:
          "Surplus generation is injected into the Cooperaliança grid and credited to offset nighttime consumption.",
        icon: "dollar",
      },
      {
        title: "Operational Status",
        description: "All three inverters ran steadily with no grid anomalies.",
        icon: "tools",
      },
    ],
  },
  monthly: {
    summary:
      "The monthly energy balance remains solid, backed by a large credit reserve with Cooperaliança (over 9,000 kWh). This reserve provides energy security and financial stability through periods of lower sunlight.",
    recommendations: [
      {
        title: "Strategic Credit Reserve",
        description:
          "The credit balance at Cooperaliança comfortably covers consumption in the months with less sunlight.",
        icon: "shield",
      },
      {
        title: "Financial Return",
        description: "The plant's self-sufficiency steadily and substantially reduces the monthly energy bill.",
        icon: "dollar",
      },
      {
        title: "Preventive Maintenance",
        description: "Periodic visual inspection of the modules preserves their full capture and generation capacity.",
        icon: "tools",
      },
    ],
  },
};

/** Static analysis shown when no Gemini model responds and there is no cached analysis for today. */
export function getFallbackAdvisorAnalysis(locale: Locale): AdvisorResult {
  return locale === "en" ? fallbackAnalysisEn : fallbackAnalysisPtBR;
}

const TABLE = "ai_advisor_daily";

/** Returns current date formatted in Brasília timezone (YYYY-MM-DD) */
export function getBrasiliaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Checks if model used matches primary model (accepts version/suffix variations). */
export function isPrimaryModel(modelUsed: string, primaryModel: string): boolean {
  const used = modelUsed.trim().toLowerCase();
  const primary = primaryModel.trim().toLowerCase();
  return used === primary || used.includes(primary) || primary.includes(used);
}

/** Reads daily quota state; returns zeroed quota when absent or on error. */
export async function getQuotaState(): Promise<QuotaState> {
  const date = getBrasiliaDate();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("primary_count, total_calls")
    .eq("date", date)
    .maybeSingle();

  if (error) console.error("Error reading AI Advisor quota:", error);
  return { date, primary_count: data?.primary_count ?? 0, total_calls: data?.total_calls ?? 0 };
}

/** Records a successful Gemini call and returns the updated quota state. */
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
    console.error("Error incrementing quota via RPC, applying fallback:", error);
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

/** Reads the cached analysis generated today, if available. */
export async function getAdvisorCache(): Promise<CachedAdvisorData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("analysis, model_used, analysis_updated_at")
    .eq("date", getBrasiliaDate())
    .maybeSingle();

  if (error) {
    console.error("Error reading AI Advisor cache:", error);
    return null;
  }
  if (!data?.analysis) return null;

  return {
    data: data.analysis as unknown as AdvisorResult,
    modelUsed: data.model_used ?? "",
    updatedAt: data.analysis_updated_at ?? "",
  };
}

/** Saves the generated analysis to daily cache. */
export async function saveAdvisorCache(data: AdvisorResult, modelUsed: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      date: getBrasiliaDate(),
      analysis: data as unknown as Json,
      model_used: modelUsed,
      analysis_updated_at: new Date().toISOString(),
    },
    { onConflict: "date" },
  );
  if (error) console.error("Error saving AI Advisor cache:", error);
}
