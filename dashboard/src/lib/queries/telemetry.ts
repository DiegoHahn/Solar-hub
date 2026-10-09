import { createClient } from "@/lib/supabase/server";
import type { SolarTelemetryRow, SunCurvePoint } from "@/lib/types";
import { toBrasiliaIsoDate } from "@/lib/dates";

const NOMINAL_CAPACITY_KW = 16.0;
const TZ = "America/Sao_Paulo";

export async function getLatestTelemetry(): Promise<SolarTelemetryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solar_telemetry")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as unknown as SolarTelemetryRow) : null;
}

export type SunCurveRow = Pick<SolarTelemetryRow, "recorded_at" | "total_power_kw" | "inverters_data">;

const SLOT_MINUTES = 30;
const SLOT_MATCH_WINDOW_MS = 20 * 60 * 1000;

/**
 * Builds fixed 30-minute daily grid from 05:00 to 20:00 in Brasília timezone.
 * This interval covers 100% of the solar window in Içara/SC on the longest day of the year
 * (summer solstice on Dec 21: sunrise at 05:14 and sunset at 19:16).
 * Future slots (after `now`) are set to null to preserve a fixed X-axis without drawing false lines.
 */
export function buildSunCurveGrid(
  rows: SunCurveRow[],
  todayIso: string,
  now: Date = new Date(),
): SunCurvePoint[] {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

  const rawPoints = rows.map((row) => {
    const invs = row.inverters_data || [];
    const powerOf = (id: string) => invs.find((i) => i.id === id)?.power_w || 0;
    return {
      time: formatTime(new Date(row.recorded_at)),
      timestamp: new Date(row.recorded_at).getTime(),
      power_kw: Number((row.total_power_kw || 0).toFixed(2)),
      nominal_cap_kw: NOMINAL_CAPACITY_KW,
      solis_kw: Number((powerOf("inv_1") / 1000).toFixed(2)),
      goodwe1_kw: Number((powerOf("inv_2") / 1000).toFixed(2)),
      goodwe2_kw: Number((powerOf("inv_3") / 1000).toFixed(2)),
    };
  });

  const grid: SunCurvePoint[] = [];
  const startSlot = new Date(`${todayIso}T05:00:00-03:00`);
  const endSlot = new Date(`${todayIso}T20:00:00-03:00`);
  const nowMs = now.getTime();

  const currentSlot = new Date(startSlot);
  while (currentSlot <= endSlot) {
    const slotTimeMs = currentSlot.getTime();
    const isFuture = slotTimeMs > nowMs;

    if (isFuture) {
      grid.push({
        time: formatTime(currentSlot),
        power_kw: null,
        nominal_cap_kw: NOMINAL_CAPACITY_KW,
        solis_kw: null,
        goodwe1_kw: null,
        goodwe2_kw: null,
      });
    } else {
      let closest: (typeof rawPoints)[number] | null = null;
      let closestDiff = Infinity;
      for (const p of rawPoints) {
        const diff = Math.abs(p.timestamp - slotTimeMs);
        if (diff < closestDiff) {
          closest = p;
          closestDiff = diff;
        }
      }
      const matched = closestDiff <= SLOT_MATCH_WINDOW_MS ? closest : null;

      grid.push({
        time: formatTime(currentSlot),
        power_kw: matched?.power_kw ?? 0,
        nominal_cap_kw: NOMINAL_CAPACITY_KW,
        solis_kw: matched?.solis_kw ?? 0,
        goodwe1_kw: matched?.goodwe1_kw ?? 0,
        goodwe2_kw: matched?.goodwe2_kw ?? 0,
      });
    }

    currentSlot.setMinutes(currentSlot.getMinutes() + SLOT_MINUTES);
  }

  return grid;
}

export async function getTodaySunCurve(): Promise<SunCurvePoint[]> {
  try {
    const now = new Date();
    const todayIso = toBrasiliaIsoDate(now);
    const startOfFetch = new Date(`${todayIso}T04:30:00-03:00`);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("solar_telemetry")
      .select("recorded_at, total_power_kw, inverters_data")
      .gte("recorded_at", startOfFetch.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(300);

    if (error) {
      console.error("Error querying daily curve from Supabase:", error);
      return [];
    }

    return buildSunCurveGrid((data ?? []) as unknown as SunCurveRow[], todayIso, now);
  } catch (err) {
    console.error("Error querying daily curve from Supabase:", err);
    return [];
  }
}
