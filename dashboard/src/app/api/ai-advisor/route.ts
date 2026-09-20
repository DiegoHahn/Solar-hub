import { NextResponse } from "next/server";
import {
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  AdvisorResult,
} from "@/lib/aiQuota";
import {
  getLatestTelemetry,
  getLatestUtilityData,
  getTodaySunCurve,
  GENERATOR_UC,
} from "@/lib/queries";

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

    // Carrega dados 100% reais do Supabase para injetar no prompt
    const [telemetry, utilityData, sunCurve] = await Promise.all([
      getLatestTelemetry().catch(() => null),
      getLatestUtilityData().catch(() => null),
      getTodaySunCurve().catch(() => []),
    ]);

    const uc = utilityData?.unidades_consumidoras?.[GENERATOR_UC];
    const gd = uc?.geracao_distribuida;
    const fatura = uc?.resumo_ultima_fatura;
    const hist12 = (uc as any)?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
    const lastMonthItem = hist12.length > 0 ? hist12[hist12.length - 1] : null;

    const tarifaKwh = utilityData?.tarifa_referencia?.tarifa_kwh ?? 0.77658;
    const geracaoHojeKwh = telemetry?.total_today_kwh ?? 0;
    const economiaHojeReais = geracaoHojeKwh * tarifaKwh;

    const peakPoint = sunCurve.reduce(
      (max, p) => (p.power_kw > max.power_kw ? p : max),
      sunCurve[0] || { power_kw: telemetry?.total_power_kw ?? 0, time: "—" }
    );
    const peakKw = peakPoint.power_kw || (telemetry?.total_power_kw ?? 0);
    const peakTime = peakPoint.time || "—";

    const saldoCreditosKwh = gd?.ValorProximoSaldoVencer ?? 0;
    const reservaTotalReais = Math.round(saldoCreditosKwh * tarifaKwh);

    const mesInjetadoKwh = lastMonthItem?.KwhGerado ?? 0;
    const mesCompensadoKwh = lastMonthItem?.kwhCreditado ?? 0;
    const consumoFaturadoKwh = fatura?.KwhReal ?? 0;
    const valorFaturaReais = fatura?.ValorFatura ?? 0;

    // Prompt estritamente calibrado: tom sóbrio, profissional e inteligente, sem jargões jurídicos e sem números fictícios
    const systemPrompt = `Você é um Consultor Especialista em Energia Solar.
Seu objetivo é redigir um resumo executivo claro, sóbrio, elegante e direto para os proprietários da residência em Içara/SC.
Escreva SEMPRE em Português do Brasil (PT-BR).

DIRETRIZES DE ESTILO E LINGUAGEM:
1. Idioma obrigatório: Português do Brasil (PT-BR) correto, claro e fluido.
2. Tom profissional, sóbrio e inteligente:
   - Evite linguagem infantil, excesso de exclamações ou informalidade exagerada.
   - Trate o leitor como um adulto inteligente, lúcido e consciente de seu patrimônio.
3. Clareza sem jargões burocráticos ou jurídicos:
   - NÃO use siglas de leis ou regulação como "GD I", "GD II", "Lei 14.300", "Fio B", "Art. 26".
   - Explique de maneira direta: mencione que a energia gerada tem isenção integral de taxas na compensação, gerando economia líquida na conta de luz.
4. Evite termos técnicos em inglês:
   - NÃO use termos como "edge-of-cloud", "performance ratio", "payback", "strings", etc.
   - Se o pico momentâneo ultrapassar a potência nominal de 16 kW, explique com naturalidade (ex: reflexo da luz nas nuvens ou irradiação solar ideal).
5. TRANSPARÊNCIA E DISTINÇÃO OBRIGATÓRIA ENTRE OS DADOS:
   - GERAÇÃO FÍSICA DOS INVERSORES: Medida diretamente pelos inversores da usina (Solis 6 kW e GoodWe).
   - AUTOCONSUMO RESIDENCIAL INSTANTÂNEO: A residência NÃO possui Smart Meter / medidor de corrente no quadro elétrico geral. Portanto, o consumo instantâneo no momento da geração NÃO é medido em tempo real. NÃO invente números de consumo da casa para hoje.
   - INJEÇÃO E COMPENSAÇÃO NA REDE: Registrados mensalmente pelo medidor bidirecional da concessionária Cooperaliança.
   - SALDO DE CRÉDITOS: Reserva acumulada oficial na concessionária para abater contas futuras.

DADOS REAIS DA USINA (USE EXCLUSIVAMENTE ESTES DADOS REAIS):
- Usina Solar: 16 kWp (${telemetry?.inverters_count ?? 3} inversores instalados) em Içara/SC.
- Concessionária: Cooperaliança (UC ${GENERATOR_UC}).
- Tarifa de referência: R$ ${tarifaKwh.toFixed(3)}/kWh.

HOJE (MEDIDO NOS INVERSORES):
- Geração física real nos inversores hoje: ${geracaoHojeKwh.toFixed(1)} kWh
- Pico de potência atingido: ${peakKw.toFixed(1)} kW ${peakTime !== "—" ? `(às ${peakTime})` : ""}
- Economia gerada hoje: R$ ${economiaHojeReais.toFixed(2)}
- Autoconsumo instantâneo residencial: Não monitorado em tempo real (instalação sem Smart Meter local; toda a geração alimenta os aparelhos ligados e o excedente é injetado na rede).

HISTÓRICO E RESERVA NA COOPERALIANÇA:
- Saldo total de créditos acumulados na cooperativa: ${saldoCreditosKwh.toLocaleString("pt-BR")} kWh (reserva estimada em R$ ${reservaTotalReais.toLocaleString("pt-BR")}).
- Último mês faturado pela Cooperaliança:
  - Excedente injetado na rede: ${mesInjetadoKwh.toLocaleString("pt-BR")} kWh
  - Energia compensada na fatura: ${mesCompensadoKwh.toLocaleString("pt-BR")} kWh
  - Consumo faturado da residência: ${consumoFaturadoKwh.toLocaleString("pt-BR")} kWh
  - Valor residual da fatura: R$ ${valorFaturaReais.toFixed(2)}

Retorne EXCLUSIVAMENTE o seguinte formato JSON estrito (sem formatação markdown \`\`\`json):
{
  "daily": {
    "summary": "Parágrafo executivo e sóbrio (3 a 4 linhas) sobre a geração real de hoje (${geracaoHojeKwh.toFixed(1)} kWh), o pico de potência atingido (${peakKw.toFixed(1)} kW), a economia estimada (R$ ${economiaHojeReais.toFixed(2)}) e a dinâmica de suprir a residência e injetar o excedente na rede.",
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
    "summary": "Parágrafo executivo e sóbrio (3 a 4 linhas) sobre o faturamento da Cooperaliança, a injeção faturada (${mesInjetadoKwh.toLocaleString("pt-BR")} kWh), o saldo acumulado de créditos (${saldoCreditosKwh.toLocaleString("pt-BR")} kWh) e a segurança energética gerada para períodos de menor insolação.",
    "recommendations": [
      {
        "title": "Título conciso da recomendação",
        "description": "Orientação estratégica para a gestão dos créditos em 1 frase.",
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
