import { brasiliaClock } from "./dates";

export const SOLAR_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutos
export const UTILITY_MAX_AGE_MS = 26 * 60 * 60 * 1000; // 26 horas

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
        "Horário noturno em Brasília (fora de 06h–19h). Telemetria solar em repouso.",
      timestamp: input.solarTelemetry?.recorded_at,
    };
  } else if (!input.solarTelemetry) {
    solarResult = {
      status: "missing",
      message: "Nenhum registro de telemetria solar encontrado na base de dados.",
    };
    errors.push(solarResult.message);
  } else {
    const recordedAt = new Date(input.solarTelemetry.recorded_at);
    const ageMs = Math.max(0, now.getTime() - recordedAt.getTime());
    const ageMinutes = Math.round(ageMs / (60 * 1000));

    if (ageMs > SOLAR_MAX_AGE_MS) {
      solarResult = {
        status: "alert",
        message: `Telemetria solar desatualizada: último registro há ${ageMinutes} min (limite: 30 min durante o dia).`,
        ageMinutes,
        timestamp: input.solarTelemetry.recorded_at,
      };
      errors.push(solarResult.message);
    } else {
      solarResult = {
        status: "ok",
        message: `Telemetria solar atualizada (último registro há ${ageMinutes} min).`,
        ageMinutes,
        timestamp: input.solarTelemetry.recorded_at,
      };
    }
  }

  let utilityResult: HealthComponentResult;
  if (!input.utilityData) {
    utilityResult = {
      status: "missing",
      message: "Nenhum registro de dados da concessionária encontrado na base de dados.",
    };
    errors.push(utilityResult.message);
  } else {
    const updatedAt = new Date(input.utilityData.updated_at);
    const ageMs = Math.max(0, now.getTime() - updatedAt.getTime());
    const ageHours = Number((ageMs / (60 * 60 * 1000)).toFixed(1));

    if (ageMs > UTILITY_MAX_AGE_MS) {
      utilityResult = {
        status: "alert",
        message: `Dados da concessionária desatualizados: última atualização há ${ageHours} h (limite: 26 h).`,
        ageHours,
        timestamp: input.utilityData.updated_at,
      };
      errors.push(utilityResult.message);
    } else {
      utilityResult = {
        status: "ok",
        message: `Dados da concessionária atualizados (última atualização há ${ageHours} h).`,
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
