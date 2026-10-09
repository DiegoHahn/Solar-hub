import { brasiliaClock } from "@/lib/dates";
import { getGeneratorUc, getTariffPerKwh } from "@/lib/utility";
import type { DailyWeather } from "@/lib/weather";
import type { SolarTelemetryRow, SunCurvePoint, UtilityDataRow } from "@/lib/types";
import type { Locale } from "@/i18n/types";
import { en } from "@/i18n/locales/en";

/** Plant data injected into the advisor prompt; each source may be missing when its query failed. */
export interface AdvisorPromptData {
  telemetry: SolarTelemetryRow | null;
  utilityData: UtilityDataRow | null;
  sunCurve: SunCurvePoint[];
  weatherHistory: DailyWeather[];
}

/**
 * Builds the Gemini prompt for the AI advisor: an interpretive analysis (not just reading numbers back)
 * tailored to the plant owners, answered in the display language as strict JSON.
 * `now` decides whether the day is still in progress, which changes how partial generation is described.
 */
export function buildAdvisorPrompt(
  { telemetry, utilityData, sunCurve, weatherHistory }: AdvisorPromptData,
  locale: Locale,
  now: Date = new Date(),
): string {
  const isEn = locale === "en";
  const uc = getGeneratorUc(utilityData);
  const gd = uc?.geracao_distribuida;
  const lastBill = uc?.resumo_ultima_fatura;
  const hist12 = uc?.grafico_historico_12_meses?.RetornoDadosHistoricoGeracaoConsumoKwhNormal || [];
  const lastMonthItem = hist12.length > 0 ? hist12[hist12.length - 1] : null;

  const tariffPerKwh = getTariffPerKwh(utilityData) ?? 0;
  const todayGenerationKwh = telemetry?.total_today_kwh ?? 0;
  const todaySavingsBrl = todayGenerationKwh * tariffPerKwh;

  const { time: brasiliaTimeStr, isDaytime } = brasiliaClock(now);
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

  const outputLanguage = isEn ? "fluent, professional US English" : "Brazilian Portuguese (pt-BR)";
  return `You are an expert solar energy engineering advisor.
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
}
