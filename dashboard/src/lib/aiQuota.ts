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
      "A usina solar de 16 kW operou com excelente rendimento hoje, gerando 58,4 kWh ao longo do dia. A produção supriu com facilidade o consumo da casa e enviou 42,2 kWh para a rede da Cooperaliança, resultando em um saldo positivo de 20,7 kWh em créditos e uma economia estimada de R$ 45,35 no dia.",
    recommendations: [
      {
        title: "Aproveitamento do Sol",
        description:
          "O período entre 10h e 15h é o mais indicado para ligar aparelhos como ar-condicionado e máquinas de lavar com energia solar direta.",
        icon: "flashlight",
      },
      {
        title: "Créditos na Cooperativa",
        description:
          "A sobra de energia gerada hoje virou crédito na Cooperaliança para abater o consumo da noite e de dias chuvosos.",
        icon: "dollar",
      },
      {
        title: "Condição da Usina",
        description:
          "Os equipamentos operaram com estabilidade e segurança durante todo o pico de produção ao meio-dia.",
        icon: "tools",
      },
    ],
  },
  monthly: {
    summary:
      "No acumulado do mês, a usina produziu 1.620 kWh de energia limpa, superando o consumo da residência (1.257 kWh) e adicionando mais de 500 kWh de sobra nova à reserva. A economia acumulada alcançou R$ 1.258,00, elevando o saldo guardado na Cooperaliança para 4.051 kWh (cerca de R$ 3.145,00).",
    recommendations: [
      {
        title: "Reserva para o Inverno",
        description:
          "Os créditos guardados na Cooperaliança garantem mais de quatro meses de cobertura para as épocas de menor insolação.",
        icon: "shield",
      },
      {
        title: "Retorno Financeiro",
        description:
          "A economia líquida de mais de R$ 1.250,00 no mês representa alívio direto na despesa de energia da família.",
        icon: "dollar",
      },
      {
        title: "Cuidados Preventivos",
        description:
          "Uma inspeção visual periódica nas placas garante que poeira e folhas secas não prejudiquem a captação solar.",
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
