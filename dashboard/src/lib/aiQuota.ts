import fs from "fs";
import path from "path";

export interface QuotaState {
  date: string; // YYYY-MM-DD
  primary_count: number; // contador de chamadas do modelo primário configurado no .env
  total_calls_today: number;
  last_call_at: string;
  gemini_3_8_count?: number; // retrocompatibilidade com versões anteriores
}

export interface CachedAdvisorData {
  updatedAt: string;
  date: string;
  modelUsed: string;
  quotaCount: number;
  maxPrimaryQuota: number;
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
      "A usina solar de 16 kW operou com alto rendimento técnico hoje. A geração medida diretamente nos inversores supriu a demanda elétrica da residência durante as horas de sol, com o excedente sendo injetado na rede da concessionária para gerar créditos futuros.",
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

const QUOTA_FILE = path.join(process.cwd(), ".ai_quota.json");
const CACHE_FILE = path.join(process.cwd(), ".ai_advisor_cache.json");

/** Retorna a data atual no fuso horário de Brasília (YYYY-MM-DD) */
export function getBrasiliaDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Lê o estado atual da cota diária */
export function getQuotaState(): QuotaState {
  const today = getBrasiliaDate();
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const content = fs.readFileSync(QUOTA_FILE, "utf-8");
      const state: QuotaState = JSON.parse(content);
      if (state.date === today) {
        if (state.primary_count === undefined) {
          state.primary_count = state.gemini_3_8_count ?? 0;
        }
        return state;
      }
    }
  } catch (err) {
    console.error("Erro ao ler ai_quota.json:", err);
  }

  // Novo dia: inicializa com 0 (ou preserva o que já foi usado se configurado)
  const newState: QuotaState = {
    date: today,
    primary_count: 2, // Inicializado em 2 conforme uso registrado no AI Studio hoje
    gemini_3_8_count: 2,
    total_calls_today: 2,
    last_call_at: new Date().toISOString(),
  };
  saveQuotaState(newState);
  return newState;
}

/** Salva o estado da cota */
export function saveQuotaState(state: QuotaState) {
  try {
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar ai_quota.json:", err);
  }
}

/** Incrementa o uso do modelo */
export function incrementQuota(modelUsed: string): QuotaState {
  const state = getQuotaState();
  state.total_calls_today += 1;
  state.last_call_at = new Date().toISOString();

  const primaryModel = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim().toLowerCase();
  const used = modelUsed.trim().toLowerCase();

  // Verifica se o modelo usado foi o modelo primário configurado no .env
  if (used === primaryModel || used.includes(primaryModel) || primaryModel.includes(used)) {
    state.primary_count = (state.primary_count ?? 0) + 1;
    state.gemini_3_8_count = state.primary_count;
  }

  saveQuotaState(state);
  return state;
}

/** Lê o cache da análise gerada */
export function getAdvisorCache(): CachedAdvisorData | null {
  const today = getBrasiliaDate();
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const cached: CachedAdvisorData = JSON.parse(content);
      // Se for de hoje, o cache é válido
      if (cached.date === today) {
        return cached;
      }
    }
  } catch (err) {
    console.error("Erro ao ler ai_advisor_cache.json:", err);
  }
  return null;
}

/** Salva a análise gerada no cache persistente */
export function saveAdvisorCache(
  data: AdvisorResult,
  modelUsed: string,
  quotaCount: number,
  maxPrimaryQuota: number
) {
  const today = getBrasiliaDate();
  const cached: CachedAdvisorData = {
    updatedAt: new Date().toISOString(),
    date: today,
    modelUsed,
    quotaCount,
    maxPrimaryQuota,
    data,
  };

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar ai_advisor_cache.json:", err);
  }
}
