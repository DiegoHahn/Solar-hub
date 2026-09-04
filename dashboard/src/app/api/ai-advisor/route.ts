import { NextResponse } from "next/server";
import {
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  AdvisorResult,
} from "@/lib/aiQuota";

export async function GET() {
  const cached = getAdvisorCache();
  const quota = getQuotaState();
  const maxPrimaryQuota = parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);
  const primaryCount = quota.primary_count ?? quota.gemini_3_8_count ?? 0;

  if (cached) {
    return NextResponse.json({
      ...cached.data,
      modelUsed: cached.modelUsed,
      quotaCount: primaryCount,
      maxPrimaryQuota,
      isCached: true,
      updatedAt: cached.updatedAt,
    });
  }

  // Se não houver cache, gera a análise inicial
  return handleGenerate(false);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;
  const maxPrimaryQuota = parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);

  if (!force) {
    const cached = getAdvisorCache();
    const quota = getQuotaState();
    const primaryCount = quota.primary_count ?? quota.gemini_3_8_count ?? 0;
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        modelUsed: cached.modelUsed,
        quotaCount: primaryCount,
        maxPrimaryQuota,
        isCached: true,
        updatedAt: cached.updatedAt,
      });
    }
  }

  return handleGenerate(force);
}

async function handleGenerate(force: boolean) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY não configurada no ambiente." },
        { status: 500 }
      );
    }

    const quota = getQuotaState();
    const configuredModel = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
    const configuredFallbacks = (process.env.GEMINI_MODEL_FALLBACKS || "gemini-3.7-flash,gemini-3.6-flash")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxPrimaryQuota = parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);
    const primaryCount = quota.primary_count ?? quota.gemini_3_8_count ?? 0;

    let candidateModels: string[] = [];
    let switchedDueToQuota = false;

    // Regra de Cota: Se já atingiu a cota do modelo primário, salta direto para os fallbacks configurados no .env
    if (primaryCount >= maxPrimaryQuota) {
      switchedDueToQuota = true;
      candidateModels = [...configuredFallbacks];
      console.log(
        `[Consultor IA] Limite de ${maxPrimaryQuota} chamadas diárias do modelo primário (${configuredModel}) atingido (${primaryCount}). Usando fallbacks configurados no .env:`,
        candidateModels
      );
    } else {
      candidateModels = [configuredModel, ...configuredFallbacks];
    }

    // Prompt estritamente calibrado: tom sóbrio, profissional e inteligente, sem jargões jurídicos (Lei 14.300, GD I, Fio B) e sem termos em inglês
    const systemPrompt = `Você é um Consultor Especialista em Energia Solar.
Seu objetivo é redigir um resumo executivo claro, sóbrio, elegante e direto para os proprietários da residência em Içara/SC.
Escreva SEMPRE em Português do Brasil (PT-BR).

DIRETRIZES DE ESTILO E LINGUAGEM:
1. Idioma obrigatório: Português do Brasil (PT-BR) correto, claro e fluido.
2. Tom profissional, sóbrio e inteligente:
   - Evite linguagem infantil, excesso de exclamações ou informalidade exagerada (NÃO use expressões como "lar de vocês", "colocou no bolso", "dia lindo", etc.).
   - Trate o leitor como um adulto inteligente, lúcido e consciente de seu patrimônio.
3. Clareza sem jargões burocráticos ou jurídicos:
   - NÃO use siglas de leis ou regulação como "GD I", "GD II", "Lei 14.300", "Fio B", "Art. 26".
   - Explique de maneira direta: mencione que a energia gerada tem "isenção integral de taxas na compensação", gerando economia líquida na conta de luz.
4. Evite termos técnicos em inglês:
   - NÃO use termos como "edge-of-cloud", "performance ratio", "payback", "strings", etc.
   - Se o pico momentâneo ultrapassar a potência nominal, explique com naturalidade: "houve um pico de 16,9 kW impulsionado pela irradiação e pelo reflexo da luz nas nuvens".
5. Foco nos dados práticos e financeiros:
   - Volume gerado no período versus o consumo da residência.
   - Quanto foi consumido diretamente sem passar pela rede pública.
   - Volume excedente injetado e acumulado como créditos na Cooperaliança.
   - Economia financeira líquida em Reais (R$).
   - Saldo acumulado na cooperativa (em kWh e em R$) como reserva segura para períodos de menor sol.
   - Dicas práticas e inteligentes de uso e manutenção.

DADOS DA USINA DA FAMÍLIA:
- Usina solar de 16 kW instalada no telhado (3 inversores) em Içara/SC.
- Concessionária local: Cooperaliança.

HOJE (DIÁRIO):
- Geração no dia: 58,4 kWh (com pico de 16,9 kW ao meio-dia impulsionado pelo reflexo solar)
- Consumo total da casa: 37,7 kWh
- Consumo direto das placas: 16,2 kWh (43% da demanda diurna suprida instantaneamente sem custos)
- Excedente injetado na rede: 42,2 kWh (gerando saldo líquido de +20,7 kWh em créditos na Cooperaliança)
- Economia estimada no dia: R$ 45,35
- Clima: Ensolarado, 23°C, 4.25 horas de sol pleno

MÊS (ACUMULADO):
- Geração total no mês: 1.620 kWh (produção sólida acima da expectativa)
- Consumo total da residência: 1.257 kWh
- Excedente líquido acumulado: +523 kWh novos enviados para a cooperativa
- Saldo total acumulado na Cooperaliança: 4.051 kWh (reserva estimada em R$ 3.145,00)
- Economia acumulada no mês: R$ 1.258,00 livre de encargos de distribuição

Retorne EXCLUSIVAMENTE o seguinte formato JSON estrito (sem formatação markdown \`\`\`json):
{
  "daily": {
    "summary": "Parágrafo executivo e sóbrio (3 a 4 linhas) sobre a geração de hoje, o consumo atendido, a sobra injetada e a economia em R$.",
    "recommendations": [
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação prática e inteligente em 1 frase.",
        "icon": "flashlight"
      },
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação sobre créditos ou economia em 1 frase.",
        "icon": "dollar"
      },
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação sobre os equipamentos em 1 frase.",
        "icon": "tools"
      }
    ]
  },
  "monthly": {
    "summary": "Parágrafo executivo e sóbrio (3 a 4 linhas) sobre o acumulado do mês, o superávit, o estoque na Cooperaliança e a economia líquida em R$.",
    "recommendations": [
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação estratégica para o mês em 1 frase.",
        "icon": "shield"
      },
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação financeira em 1 frase.",
        "icon": "dollar"
      },
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação de conservação das placas em 1 frase.",
        "icon": "tools"
      }
    ]
  }
}`;

    let lastError: any = null;
    let rawText: string | null = null;
    let modelSuccessfullyUsed = candidateModels[0] || configuredModel;

    for (const modelToTry of candidateModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent`,
          {
            method: "POST",
            headers: {
              "x-goog-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(20000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            modelSuccessfullyUsed = modelToTry;
            break;
          }
        } else {
          const errText = await res.text();
          lastError = new Error(`Modelo ${modelToTry} retornou ${res.status}: ${errText}`);
          console.warn(`[Consultor IA] ${modelToTry} falhou (${res.status}). Tentando modelo alternativo.`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!rawText) {
      const cached = getAdvisorCache();
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          modelUsed: cached.modelUsed,
          switchedDueToQuota,
          quotaCount: primaryCount,
          maxPrimaryQuota,
          isCached: true,
          updatedAt: cached.updatedAt,
          warning: "Google AI Studio com alta demanda temporária. Exibindo última análise registrada.",
        });
      }
      throw lastError || new Error("Não foi possível obter resposta dos modelos do Gemini.");
    }

    const parsed: AdvisorResult = JSON.parse(rawText);

    // Incrementa a cota registrada
    const updatedQuota = incrementQuota(modelSuccessfullyUsed);
    const currentPrimaryCount = updatedQuota.primary_count ?? updatedQuota.gemini_3_8_count ?? 0;

    // Salva no cache persistente para evitar chamadas redundantes
    saveAdvisorCache(parsed, modelSuccessfullyUsed, currentPrimaryCount, maxPrimaryQuota);

    return NextResponse.json({
      ...parsed,
      modelUsed: modelSuccessfullyUsed,
      switchedDueToQuota,
      quotaCount: currentPrimaryCount,
      maxPrimaryQuota,
      isCached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Erro interno no Consultor IA:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar análise da IA" },
      { status: 500 }
    );
  }
}
