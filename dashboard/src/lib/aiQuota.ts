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

/** The `analysis` column holds one cached analysis per locale, generated on the same Brasília date. */
type LocalizedAdvisorCache = Partial<Record<Locale, CachedAdvisorData>>;

function asLocalizedCache(value: unknown): LocalizedAdvisorCache {
  if (!value || typeof value !== "object" || "daily" in value) return {};
  return value as LocalizedAdvisorCache;
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

/** Reads today's cached analysis for the locale; analyses from previous days are never returned. */
export async function getAdvisorCache(locale: Locale): Promise<CachedAdvisorData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("analysis")
    .eq("date", getBrasiliaDate())
    .maybeSingle();

  if (error) {
    console.error("Error reading AI Advisor cache:", error);
    return null;
  }
  const entry = asLocalizedCache(data?.analysis)[locale];
  return entry?.data?.daily ? entry : null;
}

/** Saves the generated analysis for the locale, keeping the other locale's analysis for the same day. */
export async function saveAdvisorCache(data: AdvisorResult, modelUsed: string, locale: Locale): Promise<void> {
  const supabase = await createClient();
  const date = getBrasiliaDate();
  const updatedAt = new Date().toISOString();

  const { data: current } = await supabase.from(TABLE).select("analysis").eq("date", date).maybeSingle();
  const analysis: LocalizedAdvisorCache = {
    ...asLocalizedCache(current?.analysis),
    [locale]: { data, modelUsed, updatedAt },
  };

  const { error } = await supabase.from(TABLE).upsert(
    {
      date,
      analysis: analysis as unknown as Json,
      model_used: modelUsed,
      analysis_updated_at: updatedAt,
    },
    { onConflict: "date" },
  );
  if (error) console.error("Error saving AI Advisor cache:", error);
}
