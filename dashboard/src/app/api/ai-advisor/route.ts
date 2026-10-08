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
} from "@/lib/queries";
import { getIcaraWeatherData } from "@/lib/weatherData";
import { getGeneratorUc, getTariffPerKwh } from "@/lib/utility";
import { brasiliaClock } from "@/lib/dates";
import { requireUser } from "@/lib/authServer";
import { singleFlight } from "@/lib/singleFlight";

import demoAdvisor from "@/lib/demo/data/advisor.json";
import demoAdvisorEn from "@/lib/demo/data/advisor.en.json";
import { isDemoMode } from "@/lib/dataSource";
import type { Locale } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { en } from "@/i18n/locales/en";
import { ptBR } from "@/i18n/locales/pt-BR";

const getMaxPrimaryQuota = () => parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Concurrent requests for the same locale (two tabs, or React Strict Mode mounting twice in development)
 * share one Gemini generation instead of each spending quota. Each caller gets its own copy of the response.
 */
const generateOnce = singleFlight<NextResponse>();

async function handleGenerate(locale: Locale): Promise<Response> {
  const response = await generateOnce(locale, () => generate(locale));
  return response.clone();
}

function respondFromDemo(locale: Locale): NextResponse {
  const data = locale === "en" ? demoAdvisorEn : demoAdvisor;
  return NextResponse.json({
    ...data,
    modelUsed: locale === "en" ? "demo mode" : "demonstração",
    quotaCount: 1,
    maxPrimaryQuota: getMaxPrimaryQuota(),
    isCached: true,
    isDemo: true,
    updatedAt: new Date().toISOString(),
  });
}

/** Responds with today's analysis for the locale if already generated. */
async function respondFromCache(locale: Locale): Promise<NextResponse | null> {
  const [cached, quota] = await Promise.all([getAdvisorCache(locale), getQuotaState()]);
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
  const locale = await getServerLocale();
  if (await isDemoMode()) {
    return respondFromDemo(locale);
  }

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return (await respondFromCache(locale)) ?? handleGenerate(locale);
}

export async function POST(req: Request) {
  const locale = await getServerLocale();
  if (await isDemoMode()) {
    return respondFromDemo(locale);
  }

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  if (!force) {
    const cachedResponse = await respondFromCache(locale);
    if (cachedResponse) return cachedResponse;
  }

  return handleGenerate(locale);
}

async function generate(locale: Locale): Promise<NextResponse> {
  try {
    const isEn = locale === "en";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured." },
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

    // Quota rule: If primary model quota has been reached, skip directly to configured fallbacks in .env
    if (primaryCount >= maxPrimaryQuota) {
      switchedDueToQuota = true;
      candidateModels = [...configuredFallbacks];
      console.log(
        `[AI Advisor] Daily limit of ${maxPrimaryQuota} calls for primary model (${configuredModel}) reached (${primaryCount}). Using fallbacks configured in .env:`,
        candidateModels
      );
    } else {
      candidateModels = [configuredModel, ...configuredFallbacks];
    }

    // Load telemetry/utility data (Supabase) and weather (Open-Meteo) to inject into prompt
    const [telemetry, utilityData, sunCurve, weatherHistory] = await Promise.all([
      getLatestTelemetry().catch(() => null),
      getLatestUtilityData().catch(() => null),
      getTodaySunCurve().catch(() => []),
      getIcaraWeatherData().catch(() => []),
    ]);

    const uc = getGeneratorUc(utilityData);
    const gd = uc?.geracao_distribuida;
    const lastBill = uc?.resumo_ultima_fatura;
    const hist12 = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
    const lastMonthItem = hist12.length > 0 ? hist12[hist12.length - 1] : null;

    const tariffPerKwh = getTariffPerKwh(utilityData) ?? 0;
    const todayGenerationKwh = telemetry?.total_today_kwh ?? 0;
    const todaySavingsBrl = todayGenerationKwh * tariffPerKwh;

    const { time: brasiliaTimeStr, isDaytime } = brasiliaClock();
    const currentPowerKw = telemetry?.total_power_kw ?? 0;

    const peakPoint = sunCurve.reduce(
      (max, p) => ((p.power_kw ?? 0) > (max.power_kw ?? 0) ? p : max),
      sunCurve.find((p) => p.power_kw !== null) || { power_kw: telemetry?.total_power_kw ?? 0, time: "—" }
    );
    const peakKw = peakPoint.power_kw ?? (telemetry?.total_power_kw ?? 0);
    const peakTime = peakPoint.time || "—";

    // Weather for today and the measured production of recent complete sunny days (Open-Meteo)
    const todayWeather = weatherHistory.find((w) => w.isToday);
    const recentSunnyDays = weatherHistory.filter((w) => w.isReal && !w.isToday && w.solarRadiationHsp >= 4.5);
    const avgRecentProduction =
      recentSunnyDays.length > 0
        ? (recentSunnyDays.reduce((acc, d) => acc + d.estimatedKwh, 0) / recentSunnyDays.length).toFixed(1)
        : null;

    const todayWeatherBlock = todayWeather
      ? `- Weather measured in Içara today:
  * Condition: ${en.weather[todayWeather.conditionKey]}
  * Effective full sun hours: ${todayWeather.sunshineHours} h
  * Solar irradiation (HSP): ${todayWeather.solarRadiationHsp} kWh/m²
  * Accumulated rain: ${todayWeather.precipitationMm} mm
  * Maximum temperature: ${todayWeather.tempMax}°C`
      : "- Weather measured in Içara today: not available (do not infer weather conditions).";
    const plantReferenceLine = avgRecentProduction
      ? `- Plant reference: on typical sunny days (full day completed), daily production averages about ${avgRecentProduction} kWh.`
      : "- Plant reference: no complete sunny day in the recent history; do not compare with a typical day.";
    const todaySavingsText = tariffPerKwh > 0 ? ` (accumulated savings: R$ ${todaySavingsBrl.toFixed(2)})` : "";

    const creditBalanceKwh = gd?.ValorProximoSaldoVencer;
    const creditBalanceLine =
      creditBalanceKwh !== undefined
        ? `${creditBalanceKwh} kWh${tariffPerKwh > 0 ? ` (estimated reserve of R$ ${Math.round(creditBalanceKwh * tariffPerKwh)})` : ""}.`
        : "not available (do not estimate the reserve).";

    const monthInjectedKwh = lastMonthItem?.KwhGerado ?? 0;
    const monthCompensatedKwh = lastMonthItem?.kwhCreditado ?? 0;
    const billedConsumptionKwh = lastBill?.KwhReal ?? 0;
    const billAmountBrl = lastBill?.ValorFatura ?? 0;

    // Advisor prompt: interpretive analysis (not just reading numbers) tailored to system owners
    const outputLanguage = isEn ? "fluent, professional US English" : "Brazilian Portuguese (pt-BR)";
    const systemPrompt = `You are an expert solar energy engineering advisor.
Your role is NOT to list numbers already shown on screen, but to provide a REAL, CRITICAL AND INTERPRETIVE ANALYSIS of the plant data for the owners of a home in Içara/SC, Brazil.
Write ALL text values of the response in ${outputLanguage}.

CORE ANALYSIS GUIDELINES:
1. DO NOT JUST READ NUMBERS BACK:
   - Avoid redundant sentences such as "Today's generation was X, the peak was Y, the savings were Z".
   - Connect causes and effects: explain how TODAY'S WEATHER (sunshine hours, HSP irradiation, clouds or rain) shaped generation and the yield per sun hour.
   - Make clear when it is best to run household loads, given the weather and the production curve.
2. TIME CONTEXT AND ONGOING GENERATION (VERY IMPORTANT):
   - Current analysis time: ${brasiliaTimeStr} (Brasília time).
   ${
     isDaytime
       ? `- THE DAY IS STILL IN PROGRESS (daytime). The plant is running and producing ${currentPowerKw.toFixed(1)} kW right now.
   - The ${todayGenerationKwh.toFixed(1)} kWh value is a PARTIAL total accumulated until ${brasiliaTimeStr}, NOT the final total for the day. The sun has not set and the plant will keep generating until dusk.
   - NEVER write as if the day were over (avoid phrases like "limited production to X kWh today", "resulted in only X kWh today" or "the day closed with"). Use phrases like "production accumulated until ${brasiliaTimeStr}" or "the pace observed this morning/afternoon".
   - NEVER compare the partial generation of an ongoing day with the full-day average of a sunny day${avgRecentProduction ? ` (${avgRecentProduction} kWh)` : ""} as if it were the final result. There are still sun hours ahead.`
       : `- NIGHTTIME (daytime generation finished): it is ${brasiliaTimeStr} and the sun has set. The ${todayGenerationKwh.toFixed(1)} kWh value is the final, consolidated production for today.`
   }
3. LANGUAGE AND TONE:
   - Correct, clear, sober and professional ${outputLanguage}.
   - Treat the reader as an intelligent adult who understands their investment.
   - DO NOT use childish language or forced informality.
4. NO REGULATORY OR TECHNICAL JARGON:
   - DO NOT cite regulation acronyms such as "GD I", "GD II", "Lei 14.300", "Fio B" or "Art. 26". Simply explain that the credits are fully exempt when offset against the bill.
   - DO NOT use jargon such as "performance ratio", "edge-of-cloud", "payback" or "strings". Explain everything in plain words (e.g. "solar irradiation", "instantaneous power", "full sun hours").
5. CONSUMPTION TRANSPARENCY:
   - The house has no smart meter on the main panel, so instantaneous consumption is not measured. Do not invent household consumption figures for today.

REAL PLANT DATA (USE ONLY THIS DATA):
- Solar plant: 16 kWp (${telemetry?.inverters_count ?? 3} inverters) in Içara/SC.
- Utility: Cooperaliança. Tariff: ${tariffPerKwh > 0 ? `R$ ${tariffPerKwh.toFixed(3)}/kWh` : "not available (do not estimate savings in reais)"}.

TODAY'S MEASUREMENTS:
- Analysis time: ${brasiliaTimeStr} (Brasília time)
- Plant status: ${isDaytime ? `Generating during daytime (${currentPowerKw.toFixed(1)} kW right now)` : "Daytime generation finished (nighttime)"}
- Production accumulated until ${brasiliaTimeStr}: ${todayGenerationKwh.toFixed(1)} kWh ${isDaytime ? "(partial, day in progress)" : "(final total for the day)"}${todaySavingsText}
- Peak power recorded today: ${peakKw.toFixed(1)} kW ${peakTime !== "—" ? `at ${peakTime}` : ""} (out of 16 kWp installed capacity)
${todayWeatherBlock}
${plantReferenceLine}

COOPERALIANÇA HISTORY AND CREDIT RESERVE:
- Total credit balance accumulated with the cooperative: ${creditBalanceLine}
- Last billed month:
  * Surplus injected: ${monthInjectedKwh} kWh
  * Offset on the bill: ${monthCompensatedKwh} kWh
  * Billed household consumption: ${billedConsumptionKwh} kWh
  * Remaining bill amount: R$ ${billAmountBrl.toFixed(2)}

Return ONLY the following strict JSON (no \`\`\`json markdown fences):
{
  "daily": {
    "summary": "Executive analytical text (3 to 4 lines) interpreting today's performance against the real weather in Içara (sun hours, rain and irradiation). ${isDaytime ? `Note: it is ${brasiliaTimeStr} and the day is still in progress (partial generation so far, plant producing ${currentPowerKw.toFixed(1)} kW). Interpret the generation pace so far without treating it as the final result.` : "Since daytime generation has finished, give the final consolidated assessment of the day."} Provide an insight the user would not get from the raw numbers alone.",
    "recommendations": [
      {
        "title": "Concise title of the practical recommendation",
        "description": "One sentence connecting weather/generation to mindful household usage.",
        "icon": "flashlight"
      },
      {
        "title": "Concise title about savings or credits",
        "description": "One sentence on the value of the surplus and bill offsetting.",
        "icon": "dollar"
      },
      {
        "title": "Concise title about technical operation",
        "description": "One sentence of equipment care or monitoring guidance.",
        "icon": "tools"
      }
    ]
  },
  "monthly": {
    "summary": "Executive analytical text (3 to 4 lines) assessing the strength of the energy reserve at Cooperaliança against seasonal weather variation. Highlight the safety margin in kWh/R$ and the financial soundness of the system for the next billing cycles.",
    "recommendations": [
      {
        "title": "Concise title of the strategic recommendation",
        "description": "One sentence of strategy on covering colder or rainier months.",
        "icon": "shield"
      },
      {
        "title": "Concise financial title",
        "description": "One sentence diagnosing the consolidated financial return on the bill.",
        "icon": "dollar"
      },
      {
        "title": "Concise preventive title",
        "description": "One sentence of maintenance or periodic inspection guidance.",
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
      console.log(`[AI Advisor] Attempting generation with ${modelToTry}...`);
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
            console.log(`[AI Advisor] Success with ${modelToTry} in ${elapsed}s!`);
            break;
          }
        } else {
          const errText = await res.text();
          lastError = new Error(`Model ${modelToTry} returned ${res.status}: ${errText}`);
          console.warn(`[AI Advisor] ${modelToTry} failed (${res.status}) in ${elapsed}s. Trying next...`);
        }
      } catch (err) {
        const elapsed = ((Date.now() - modelStart) / 1000).toFixed(1);
        lastError = err;
        console.warn(`[AI Advisor] ${modelToTry} errored/timed out (${errorMessage(err)}) in ${elapsed}s. Trying next...`);
      }
    }

    if (!rawText) {
      console.error(`[AI Advisor] All models failed. Last error: ${errorMessage(lastError)}`);
      const cached = await getAdvisorCache(locale);
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          modelUsed: cached.modelUsed,
          switchedDueToQuota,
          quotaCount: primaryCount,
          maxPrimaryQuota,
          isCached: true,
          updatedAt: cached.updatedAt,
          warning: isEn ? en.aiAdvisor.showingLastAnalysis : ptBR.aiAdvisor.showingLastAnalysis,
        });
      }

      return NextResponse.json(
        { error: isEn ? en.aiAdvisor.unavailable : ptBR.aiAdvisor.unavailable, unavailable: true },
        { status: 503 },
      );
    }

    const parsed: AdvisorResult = JSON.parse(rawText);

    // Increment registered quota
    const updatedQuota = await incrementQuota(modelSuccessfullyUsed);
    const currentPrimaryCount = updatedQuota.primary_count;

    // Save to persistent cache to prevent redundant calls
    await saveAdvisorCache(parsed, modelSuccessfullyUsed, locale);

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
    console.error("[AI Advisor] Internal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error processing AI analysis" },
      { status: 500 }
    );
  }
}
