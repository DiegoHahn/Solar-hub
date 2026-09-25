import { getTelemetryByDay } from "@/lib/queries";
import { fallbackDailyWeather, parseWmoCode, type DailyWeather } from "@/lib/weather";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Busca histórico recente e previsão do tempo via Open-Meteo
 * Cruza com a telemetria registrada no Supabase (se houver para a data)
 */
export async function getIcaraWeatherData(): Promise<DailyWeather[]> {
  try {
    const lat =
      process.env.NEXT_PUBLIC_SOLAR_LATITUDE ||
      process.env.SOLAR_LATITUDE ||
      "-28.7139";
    const lon =
      process.env.NEXT_PUBLIC_SOLAR_LONGITUDE ||
      process.env.SOLAR_LONGITUDE ||
      "-49.3003";
    const tilt =
      process.env.NEXT_PUBLIC_SOLAR_TILT || process.env.SOLAR_TILT || "15";
    const azimuth =
      process.env.NEXT_PUBLIC_SOLAR_AZIMUTH ||
      process.env.SOLAR_AZIMUTH ||
      "155";

    const [res, realTelemetryByDay] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,shortwave_radiation_sum,precipitation_sum&tilt=${tilt}&azimuth=${azimuth}&timezone=America%2FSao_Paulo&past_days=90&forecast_days=1`,
        { next: { revalidate: 3600 } }
      ),
      getTelemetryByDay(90),
    ]);

    if (!res.ok) throw new Error("Falha na chamada Open-Meteo");

    const data = await res.json();
    const times: string[] = data.daily?.time || [];
    const weatherCodes: number[] = data.daily?.weather_code || [];
    const maxTemps: number[] = data.daily?.temperature_2m_max || [];
    const minTemps: number[] = data.daily?.temperature_2m_min || [];
    const sunshine: number[] = data.daily?.sunshine_duration || [];
    const radiation: number[] = data.daily?.shortwave_radiation_sum || [];
    const precip: number[] = data.daily?.precipitation_sum || [];

    const todayIso = new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).split("/").reverse().join("-");

    const result: DailyWeather[] = times.map((t, idx) => {
      const parts = t.split("-");
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const dayOfWeek = dayNames[dateObj.getDay()];
      const isToday = t === todayIso;
      const formattedDate = isToday ? "Hoje" : `${parts[2]}/${parts[1]}`;
      const code = weatherCodes[idx] ?? 0;
      const { condition, icon } = parseWmoCode(code);

      // Conversão: 1 MJ/m² = 1 / 3.6 kWh/m²
      const radMj = radiation[idx] ?? 15.0;
      const hsp = Number((radMj / 3.6).toFixed(2));
      const sunHours = Number(((sunshine[idx] ?? 0) / 3600).toFixed(1));

      // Havendo telemetria dos inversores para o dia, usa a geração medida; senão, estima por 16 kWp × HSP × 0.81
      const hasRealData = realTelemetryByDay && realTelemetryByDay[t] !== undefined;
      const actualKwh = hasRealData
        ? Number(realTelemetryByDay[t].toFixed(1))
        : Number((16.0 * hsp * 0.81).toFixed(1));

      return {
        date: t,
        dayOfWeek,
        formattedDate,
        weatherCode: code,
        condition,
        icon,
        tempMax: maxTemps[idx] ?? 22,
        tempMin: minTemps[idx] ?? 14,
        sunshineHours: sunHours,
        solarRadiationHsp: hsp,
        precipitationMm: precip[idx] ?? 0,
        estimatedKwh: actualKwh,
        isReal: hasRealData,
        realKwh: hasRealData ? actualKwh : undefined,
      };
    });

    return result.length > 0 ? result : fallbackDailyWeather;
  } catch {
    return fallbackDailyWeather;
  }
}
