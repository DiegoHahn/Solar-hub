import { NextResponse } from "next/server";
import {
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  parseAdvisorResult,
  type AdvisorResult,
} from "@/lib/aiQuota";
import {
  getLatestTelemetry,
  getLatestUtilityData,
  getTodaySunCurve,
} from "@/lib/queries";
import { getPlantWeatherData } from "@/lib/weatherData";
import { buildAdvisorPrompt } from "@/lib/aiAdvisorPrompt";
import { requireUser } from "@/lib/authServer";
import { singleFlight } from "@/lib/singleFlight";

import demoAdvisor from "@/lib/demo/data/advisor.json";
import demoAdvisorEn from "@/lib/demo/data/advisor.en.json";
import { isDemoMode } from "@/lib/dataSource";
import type { Locale } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n/dictionaries";

const getMaxPrimaryQuota = () => parseInt(process.env.GEMINI_PRIMARY_MAX_QUOTA || "4", 10);

/** Minimum interval between forced regenerations, so repeated clicks do not spend model quota. */
const FORCE_REGENERATE_COOLDOWN_MS = 10 * 60 * 1000;

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
    modelUsed: getDictionary(locale).aiAdvisor.demoModelLabel,
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
    return handleGenerate(locale);
  }

  const quota = await getQuotaState();
  const sinceLastMs = quota.last_call_at ? Date.now() - new Date(quota.last_call_at).getTime() : Infinity;
  if (sinceLastMs < FORCE_REGENERATE_COOLDOWN_MS) {
    const minutes = Math.ceil((FORCE_REGENERATE_COOLDOWN_MS - sinceLastMs) / 60000);
    return NextResponse.json(
      { error: getDictionary(locale).aiAdvisor.cooldown.replace("{minutes}", String(minutes)), cooldown: true },
      { status: 429 },
    );
  }

  return handleGenerate(locale);
}

async function generate(locale: Locale): Promise<NextResponse> {
  try {
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
    } else {
      candidateModels = [configuredModel, ...configuredFallbacks];
    }

    // Load telemetry/utility data (Supabase) and weather (Open-Meteo) to inject into prompt
    const [telemetry, utilityData, sunCurve, weatherHistory] = await Promise.all([
      getLatestTelemetry().catch(() => null),
      getLatestUtilityData().catch(() => null),
      getTodaySunCurve().catch(() => []),
      getPlantWeatherData().catch(() => []),
    ]);

    const systemPrompt = buildAdvisorPrompt({ telemetry, utilityData, sunCurve, weatherHistory }, locale);

    const failures: string[] = [];
    let parsed: AdvisorResult | null = null;
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
            signal: AbortSignal.timeout(12000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const candidate = rawText ? parseAdvisorResult(rawText) : null;
          if (candidate) {
            parsed = candidate;
            modelSuccessfullyUsed = modelToTry;
            break;
          }
          failures.push(`${modelToTry}: unexpected response shape`);
        } else {
          failures.push(`${modelToTry}: HTTP ${res.status} ${await res.text()}`);
        }
      } catch (err) {
        failures.push(`${modelToTry}: ${errorMessage(err)}`);
      }
    }

    if (!parsed) {
      console.error(`[AI Advisor] All models failed. ${failures.join(" | ") || "No model configured."}`);
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
          warning: getDictionary(locale).aiAdvisor.showingLastAnalysis,
        });
      }

      return NextResponse.json(
        { error: getDictionary(locale).aiAdvisor.unavailable, unavailable: true },
        { status: 503 },
      );
    }

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
