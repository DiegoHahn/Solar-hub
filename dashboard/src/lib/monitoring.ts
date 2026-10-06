import { brasiliaClock } from "./dates";

export const SOLAR_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
export const UTILITY_MAX_AGE_MS = 26 * 60 * 60 * 1000; // 26 hours

export interface SolarTelemetryRecord {
  recorded_at: string;
}

export interface UtilityDataRecord {
  updated_at: string;
}

export interface MonitoringEvaluationInput {
  solarTelemetry: SolarTelemetryRecord | null;
  utilityData: UtilityDataRecord | null;
  now?: Date;
}

export interface HealthComponentResult {
  status: "ok" | "alert" | "skipped_night" | "missing";
  message: string;
  ageMinutes?: number;
  ageHours?: number;
  timestamp?: string;
}

export interface TelemetryHealthReport {
  ok: boolean;
  brasiliaTime: string;
  isDaytime: boolean;
  solar: HealthComponentResult;
  utility: HealthComponentResult;
  errors: string[];
}

export function evaluateTelemetryHealth(
  input: MonitoringEvaluationInput,
): TelemetryHealthReport {
  const now = input.now ?? new Date();
  const { time, isDaytime } = brasiliaClock(now);
  const errors: string[] = [];

  let solarResult: HealthComponentResult;
  if (!isDaytime) {
    solarResult = {
      status: "skipped_night",
      message:
        "Nighttime in Brasília (outside 06:00–19:00). Solar telemetry idle.",
      timestamp: input.solarTelemetry?.recorded_at,
    };
  } else if (!input.solarTelemetry) {
    solarResult = {
      status: "missing",
      message: "No solar telemetry records found in database.",
    };
    errors.push(solarResult.message);
  } else {
    const recordedAt = new Date(input.solarTelemetry.recorded_at);
    const ageMs = Math.max(0, now.getTime() - recordedAt.getTime());
    const ageMinutes = Math.round(ageMs / (60 * 1000));

    if (ageMs > SOLAR_MAX_AGE_MS) {
      solarResult = {
        status: "alert",
        message: `Solar telemetry outdated: last recorded ${ageMinutes}m ago (limit: 30m during daytime).`,
        ageMinutes,
        timestamp: input.solarTelemetry.recorded_at,
      };
      errors.push(solarResult.message);
    } else {
      solarResult = {
        status: "ok",
        message: `Solar telemetry up to date (last recorded ${ageMinutes}m ago).`,
        ageMinutes,
        timestamp: input.solarTelemetry.recorded_at,
      };
    }
  }

  let utilityResult: HealthComponentResult;
  if (!input.utilityData) {
    utilityResult = {
      status: "missing",
      message: "No utility records found in database.",
    };
    errors.push(utilityResult.message);
  } else {
    const updatedAt = new Date(input.utilityData.updated_at);
    const ageMs = Math.max(0, now.getTime() - updatedAt.getTime());
    const ageHours = Number((ageMs / (60 * 60 * 1000)).toFixed(1));

    if (ageMs > UTILITY_MAX_AGE_MS) {
      utilityResult = {
        status: "alert",
        message: `Utility data outdated: last updated ${ageHours}h ago (limit: 26h).`,
        ageHours,
        timestamp: input.utilityData.updated_at,
      };
      errors.push(utilityResult.message);
    } else {
      utilityResult = {
        status: "ok",
        message: `Utility data up to date (last updated ${ageHours}h ago).`,
        ageHours,
        timestamp: input.utilityData.updated_at,
      };
    }
  }

  return {
    ok: errors.length === 0,
    brasiliaTime: time,
    isDaytime,
    solar: solarResult,
    utility: utilityResult,
    errors,
  };
}
