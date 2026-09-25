import { NextResponse } from "next/server";
import {
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  AdvisorResult,
  fallbackAdvisorAnalysis,
} from "@/lib/aiQuota";
import {
  getLatestTelemetry,
  getLatestUtilityData,
  getTodaySunCurve,
} from "@/lib/queries";
import { getIcaraWeatherData } from "@/lib/weatherData";
import { getGeneratorUc } from "@/lib/utility";

const getMaxPrimaryQuota = () => parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);

/** Responde com a análise do dia já gerada, se existir. */
async function respondFromCache(): Promise<NextResponse | null> {
  const [cached, quota] = await Promise.all([getAdvisorCache(), getQuotaState()]);
  if (!cached) return null;

  return NextResponse.json({
    ...cached.data,
    modelUsed: cached.modelUsed,
    quotaCount: quota.primary_count,
    maxPrimaryQuota: getMaxPrimaryQuota(),
    isCached: true,
    updatedAt: cached.updatedAt,
  });
}

export async function GET() {
  return (await respondFromCache()) ?? handleGenerate();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  if (!force) {
    const cachedResponse = await respondFromCache();
    if (cachedResponse) return cachedResponse;
  }

  return handleGenerate();
}

async function handleGenerate() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY não configurada no ambiente." },
        { status: 500 }
      );
    }

    const quota = await getQuotaState();
    const configuredModel = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
    const configuredFallbacks = (process.env.GEMINI_MODEL_FALLBACKS || "gemini-3.7-flash,gemini-3.6-flash")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxPrimaryQuota = getMaxPrimaryQuota();
    const primaryCount = quota.primary_count;

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

    // Carrega telemetria/concessionária (Supabase) e clima (Open-Meteo) para injetar no prompt
    const [telemetry, utilityData, sunCurve, weatherHistory] = await Promise.all([
      getLatestTelemetry().catch(() => null),
      getLatestUtilityData().catch(() => null),
      getTodaySunCurve().catch(() => []),
      getIcaraWeatherData().catch(() => []),
    ]);

    const uc = getGeneratorUc(utilityData);
    const gd = uc?.geracao_distribuida;
    const fatura = uc?.resumo_ultima_fatura;
    const hist12 = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
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

    // Dados meteorológicos de hoje e dos últimos dias (Open-Meteo)
    const todayWeather = weatherHistory[weatherHistory.length - 1];
    const recentSunnyDays = weatherHistory.filter((w) => w.solarRadiationHsp >= 4.5);
    const avgRecentProduction =
      recentSunnyDays.length > 0
        ? (recentSunnyDays.reduce((acc, d) => acc + d.estimatedKwh, 0) / recentSunnyDays.length).toFixed(1)
        : "75.0";

    const climaHojeCondicao = todayWeather?.condition || "Parcialmente Nublado";
    const climaHojeHorasSol = todayWeather?.sunshineHours ?? 0;
    const climaHojeHsp = todayWeather?.solarRadiationHsp ?? 0;
    const climaHojeChuva = todayWeather?.precipitationMm ?? 0;
    const climaHojeTempMax = todayWeather?.tempMax ?? 24;

    const saldoCreditosKwh = gd?.ValorProximoSaldoVencer ?? 0;
    const reservaTotalReais = Math.round(saldoCreditosKwh * tarifaKwh);

    const mesInjetadoKwh = lastMonthItem?.KwhGerado ?? 0;
    const mesCompensadoKwh = lastMonthItem?.kwhCreditado ?? 0;
    const consumoFaturadoKwh = fatura?.KwhReal ?? 0;
    const valorFaturaReais = fatura?.ValorFatura ?? 0;

    // Prompt do consultor: análise interpretativa (não apenas leitura dos números) voltada aos proprietários
    const systemPrompt = `Você é um Consultor Especialista em Engenharia de Energia Solar.
Seu papel NÃO é apenas listar números que já aparecem na tela, mas sim fornecer uma ANÁLISE REAL, CRÍTICA E INTERPRETATIVA dos dados da usina para os proprietários da residência em Içara/SC.
Escreva SEMPRE em Português do Brasil (PT-BR).

DIRETRIZES FUNDAMENTAIS DE ANÁLISE:
1. NÃO SEJA UM MERO LEITOR DE NÚMEROS:
   - Evite frases redundantes como "A geração de hoje foi X, o pico foi Y, a economia foi Z".
   - Conecte as causas e efeitos: analise como o CLIMA DE HOJE (horas de sol, irradiação HSP, nuvens ou chuva) determinou o comportamento da geração e o rendimento por hora de sol.
   - Compare a geração do dia com o potencial pleno da usina de 16 kWp: contextualize se o resultado reflete um dia de céu fechado/chuvoso ou dia de sol pleno, explicando por que a produção foi mais contida ou mais vigorosa.
   - Dê clareza sobre o momento ideal para uso de cargas na casa em função do clima e da curva de produção.
2. IDIOMA E TOM:
   - Português do Brasil (PT-BR) correto, elegante, sóbrio e profissional.
   - Trate o leitor como um adulto inteligente, lúcido e consciente do seu investimento patrimonial.
   - NÃO use linguagem infantil nem informalidade forçada (evite "lar de vocês", "colocou no bolso", etc.).
3. SEM JARGÕES BUROCRÁTICOS OU EM INGLÊS:
   - NÃO use siglas de leis como "GD I", "GD II", "Lei 14.300", "Fio B", "Art. 26". Explique simplesmente que os créditos contam com isenção integral na compensação da conta.
   - NÃO use termos em inglês como "performance ratio", "edge-of-cloud", "payback", "strings". Explique tudo em português claro (ex: "irradiação solar", "potência instantânea", "horas de sol pleno").
4. TRANSPARÊNCIA SOBRE CONSUMO:
   - A casa não possui Smart Meter no quadro geral. O consumo instantâneo não é medido em tempo real. Não invente números de consumo da casa para hoje.

DADOS REAIS DA USINA (USE EXCLUSIVAMENTE ESTES DADOS):
- Usina Solar: 16 kWp (${telemetry?.inverters_count ?? 3} inversores instalados) em Içara/SC.
- Concessionária: Cooperaliança (UC ${utilityData?.generator_uc ?? "—"}). Tarifa: R$ ${tarifaKwh.toFixed(3)}/kWh.

MEDIDAS DE HOJE:
- Produção registrada nos inversores até o momento: ${geracaoHojeKwh.toFixed(1)} kWh (Economia acumulada: R$ ${economiaHojeReais.toFixed(2)})
- Pico de potência: ${peakKw.toFixed(1)} kW ${peakTime !== "—" ? `às ${peakTime}` : ""} (de uma capacidade instalada de 16 kWp)
- Condições climáticas medidas em Içara hoje:
  * Tempo: ${climaHojeCondicao}
  * Horas de sol pleno efetivo: ${climaHojeHorasSol} horas
  * Irradiação solar (HSP): ${climaHojeHsp} kWh/m²
  * Chuva acumulada: ${climaHojeChuva} mm
  * Temperatura máxima: ${climaHojeTempMax}°C
- Parâmetro comparativo da usina: Em dias ensolarados recentes, a média diária gerada foi de aproximadamente ${avgRecentProduction} kWh.

HISTÓRICO E RESERVA NA COOPERALIANÇA:
- Saldo total de créditos acumulados na cooperativa: ${saldoCreditosKwh.toLocaleString("pt-BR")} kWh (reserva estimada em R$ ${reservaTotalReais.toLocaleString("pt-BR")}).
- Último fechamento faturado:
  * Excedente injetado: ${mesInjetadoKwh.toLocaleString("pt-BR")} kWh
  * Compensado na conta: ${mesCompensadoKwh.toLocaleString("pt-BR")} kWh
  * Consumo faturado da residência: ${consumoFaturadoKwh.toLocaleString("pt-BR")} kWh
  * Valor residual da fatura: R$ ${valorFaturaReais.toFixed(2)}

Retorne EXCLUSIVAMENTE o seguinte formato JSON estrito (sem formatação markdown \`\`\`json):
{
  "daily": {
    "summary": "Texto analítico executivo (3 a 4 linhas) interpretando o desempenho de hoje frente às condições meteorológicas reais de Içara (horas de sol, chuva e irradiação). Explique o rendimento em relação à capacidade da usina e forneça uma leitura perspicaz que o usuário não veria apenas olhando para os números brutos.",
    "recommendations": [
      {
        "title": "Título conciso da recomendação prática",
        "description": "Orientação inteligente conectando o clima/geração ao uso doméstico consciente em 1 frase.",
        "icon": "flashlight"
      },
      {
        "title": "Título conciso sobre economia ou créditos",
        "description": "Análise sobre a valorização do excedente e compensação tarifária em 1 frase.",
        "icon": "dollar"
      },
      {
        "title": "Título conciso sobre operação técnica",
        "description": "Orientação de conservação ou acompanhamento dos equipamentos em 1 frase.",
        "icon": "tools"
      }
    ]
  },
  "monthly": {
    "summary": "Texto analítico executivo (3 a 4 linhas) avaliando a robustez da reserva energética na Cooperaliança frente às variações climáticas sazonais. Destaque o colchão de segurança em kWh/R$ e a solidez financeira do sistema para os próximos ciclos de fatura.",
    "recommendations": [
      {
        "title": "Título conciso da recomendação estratégica",
        "description": "Orientação estratégica sobre a cobertura de meses mais frios ou chuvosos em 1 frase.",
        "icon": "shield"
      },
      {
        "title": "Título conciso financeiro",
        "description": "Diagnóstico do retorno financeiro consolidado na fatura em 1 frase.",
        "icon": "dollar"
      },
      {
        "title": "Título conciso preventivo",
        "description": "Diretriz de manutenção ou verificação periódica em 1 frase.",
        "icon": "tools"
      }
    ]
  }
}`;

    let lastError: unknown = null;
    let rawText: string | null = null;
    let modelSuccessfullyUsed = candidateModels[0] || configuredModel;

    for (const modelToTry of candidateModels) {
      const modelStart = Date.now();
      console.log(`[Consultor IA] Tentando gerar com ${modelToTry}...`);
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
            signal: AbortSignal.timeout(12000),
          }
        );

        const elapsed = ((Date.now() - modelStart) / 1000).toFixed(1);
        if (res.ok) {
          const data = await res.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            modelSuccessfullyUsed = modelToTry;
            console.log(`[Consultor IA] Sucesso com ${modelToTry} em ${elapsed}s!`);
            break;
          }
        } else {
          const errText = await res.text();
          lastError = new Error(`Modelo ${modelToTry} retornou ${res.status}: ${errText}`);
          console.warn(`[Consultor IA] ${modelToTry} falhou (${res.status}) em ${elapsed}s. Tentando próximo...`);
        }
      } catch (err) {
        const elapsed = ((Date.now() - modelStart) / 1000).toFixed(1);
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[Consultor IA] ${modelToTry} gerou erro/timeout (${message}) em ${elapsed}s. Tentando próximo...`);
      }
    }

    if (!rawText) {
      console.error("[Consultor IA] Todos os modelos falharam. Último erro:", lastError);
      const cached = await getAdvisorCache();
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
      
      // Se não houver cache anterior e a API do Google estiver indisponível temporariamente,
      // entrega a análise técnica contextualizada sem quebrar a interface do usuário
      return NextResponse.json({
        ...fallbackAdvisorAnalysis,
        modelUsed: candidateModels[0] || configuredModel,
        switchedDueToQuota,
        quotaCount: primaryCount,
        maxPrimaryQuota,
        isCached: false,
        updatedAt: new Date().toISOString(),
        warning: "Serviço de IA temporariamente indisponível no Google. Exibindo análise técnica preliminar.",
      });
    }

    const parsed: AdvisorResult = JSON.parse(rawText);

    // Incrementa a cota registrada
    const updatedQuota = await incrementQuota(modelSuccessfullyUsed);
    const currentPrimaryCount = updatedQuota.primary_count;

    // Salva no cache persistente para evitar chamadas redundantes
    await saveAdvisorCache(parsed, modelSuccessfullyUsed);

    return NextResponse.json({
      ...parsed,
      modelUsed: modelSuccessfullyUsed,
      switchedDueToQuota,
      quotaCount: currentPrimaryCount,
      maxPrimaryQuota,
      isCached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro interno no Consultor IA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao processar análise da IA" },
      { status: 500 }
    );
  }
}
