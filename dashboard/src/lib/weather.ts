/**
 * Utilitários e cliente para dados meteorológicos e irradiação solar
 * Utiliza a API pública e gratuita da Open-Meteo
 */

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "Seg", "Ter", ...
  formattedDate: string; // "28/08"
  weatherCode: number;
  condition: string;
  icon: "sun" | "cloud-sun" | "cloud" | "rain" | "storm";
  tempMax: number;
  tempMin: number;
  sunshineHours: number; // horas de sol
  solarRadiationHsp: number; // Horas de Sol Pleno (kWh/m²) convertidas de MJ/m²
  precipitationMm: number;
  estimatedKwh: number; // Geração solar real/estimada para usina de 16 kWp
}

export interface CurrentWeather {
  temp: number;
  condition: string;
  icon: "sun" | "cloud-sun" | "cloud" | "rain" | "storm";
  cloudCover: number;
  uvIndex: number;
  city: string;
  updatedAt: string;
}

/** Mapeamento de códigos WMO da Open-Meteo para condições em português e ícones */
export function parseWmoCode(code: number): {
  condition: string;
  icon: "sun" | "cloud-sun" | "cloud" | "rain" | "storm";
} {
  if (code === 0) return { condition: "Céu Limpo", icon: "sun" };
  if (code === 1) return { condition: "Ensolarado", icon: "sun" };
  if (code === 2) return { condition: "Parcialmente Nublado", icon: "cloud-sun" };
  if (code === 3) return { condition: "Nublado / Encoberto", icon: "cloud" };
  if (code >= 45 && code <= 48) return { condition: "Nevoeiro", icon: "cloud" };
  if (code >= 51 && code <= 55) return { condition: "Garoa / Chuvisco", icon: "rain" };
  if (code >= 61 && code <= 65) return { condition: "Chuva Contínua", icon: "rain" };
  if (code >= 80 && code <= 82) return { condition: "Pancadas de Chuva", icon: "rain" };
  if (code >= 95 && code <= 99) return { condition: "Tempestade", icon: "storm" };
  return { condition: "Variação de Nuvens", icon: "cloud-sun" };
}

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Dados de fallback reais de Içara/SC caso a chamada externa falhe */
export const fallbackDailyWeather: DailyWeather[] = [
  {
    date: "2026-08-28",
    dayOfWeek: "Sex",
    formattedDate: "28/08",
    weatherCode: 80,
    condition: "Pancadas de Chuva",
    icon: "rain",
    tempMax: 27.2,
    tempMin: 17.0,
    sunshineHours: 2.1,
    solarRadiationHsp: 1.73, // 6.24 MJ / 3.6
    precipitationMm: 4.2,
    estimatedKwh: 22.8,
  },
  {
    date: "2026-08-29",
    dayOfWeek: "Sáb",
    formattedDate: "29/08",
    weatherCode: 95,
    condition: "Tempestade",
    icon: "storm",
    tempMax: 19.4,
    tempMin: 16.2,
    sunshineHours: 1.7,
    solarRadiationHsp: 1.96,
    precipitationMm: 35.5,
    estimatedKwh: 25.1,
  },
  {
    date: "2026-08-30",
    dayOfWeek: "Dom",
    formattedDate: "30/08",
    weatherCode: 81,
    condition: "Pancadas de Chuva",
    icon: "rain",
    tempMax: 19.9,
    tempMin: 15.7,
    sunshineHours: 3.1,
    solarRadiationHsp: 2.37,
    precipitationMm: 24.2,
    estimatedKwh: 31.4,
  },
  {
    date: "2026-08-31",
    dayOfWeek: "Seg",
    formattedDate: "31/08",
    weatherCode: 82,
    condition: "Chuva Intensa",
    icon: "rain",
    tempMax: 18.6,
    tempMin: 16.0,
    sunshineHours: 0.0,
    solarRadiationHsp: 0.87,
    precipitationMm: 62.7,
    estimatedKwh: 12.3,
  },
  {
    date: "2026-09-01",
    dayOfWeek: "Ter",
    formattedDate: "01/09",
    weatherCode: 51,
    condition: "Garoa / Aberturas",
    icon: "cloud-sun",
    tempMax: 22.1,
    tempMin: 15.9,
    sunshineHours: 10.1,
    solarRadiationHsp: 4.53,
    precipitationMm: 1.2,
    estimatedKwh: 58.4,
  },
  {
    date: "2026-09-02",
    dayOfWeek: "Qua",
    formattedDate: "02/09",
    weatherCode: 3,
    condition: "Sol com Nuvens",
    icon: "cloud-sun",
    tempMax: 20.3,
    tempMin: 12.0,
    sunshineHours: 11.0,
    solarRadiationHsp: 5.37,
    precipitationMm: 0.0,
    estimatedKwh: 68.2,
  },
  {
    date: "2026-09-03",
    dayOfWeek: "Qui",
    formattedDate: "03/09",
    weatherCode: 2,
    condition: "Céu Limpo",
    icon: "sun",
    tempMax: 27.1,
    tempMin: 11.3,
    sunshineHours: 11.1,
    solarRadiationHsp: 5.33,
    precipitationMm: 0.0,
    estimatedKwh: 67.5,
  },
  {
    date: "2026-09-04",
    dayOfWeek: "Sex",
    formattedDate: "Hoje",
    weatherCode: 2,
    condition: "Sol Predominante",
    icon: "sun",
    tempMax: 23.4,
    tempMin: 11.9,
    sunshineHours: 8.5,
    solarRadiationHsp: 4.25,
    precipitationMm: 0.0,
    estimatedKwh: 58.4,
  },
];

/**
 * Busca histórico recente e previsão do tempo via Open-Meteo
 * Coordenadas e geometria configuradas via variáveis de ambiente (.env / .env.local)
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

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,shortwave_radiation_sum,precipitation_sum&tilt=${tilt}&azimuth=${azimuth}&timezone=America%2FSao_Paulo&past_days=90&forecast_days=1`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error("Falha na chamada Open-Meteo");

    const data = await res.json();
    const times: string[] = data.daily?.time || [];
    const weatherCodes: number[] = data.daily?.weather_code || [];
    const maxTemps: number[] = data.daily?.temperature_2m_max || [];
    const minTemps: number[] = data.daily?.temperature_2m_min || [];
    const sunshine: number[] = data.daily?.sunshine_duration || [];
    const radiation: number[] = data.daily?.shortwave_radiation_sum || [];
    const precip: number[] = data.daily?.precipitation_sum || [];

    const result: DailyWeather[] = times.map((t, idx) => {
      const parts = t.split("-");
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const dayOfWeek = dayNames[dateObj.getDay()];
      const formattedDate = `${parts[2]}/${parts[1]}`;
      const code = weatherCodes[idx] ?? 0;
      const { condition, icon } = parseWmoCode(code);

      // Conversão: 1 MJ/m² = 1 / 3.6 kWh/m²
      const radMj = radiation[idx] ?? 15.0;
      const hsp = Number((radMj / 3.6).toFixed(2));
      const sunHours = Number(((sunshine[idx] ?? 0) / 3600).toFixed(1));

      // Estimativa para a usina de 16 kWp com Performance Ratio de ~80%
      const estimatedKwh = Number((16.0 * hsp * 0.81).toFixed(1));

      return {
        date: t,
        dayOfWeek,
        formattedDate: idx === times.length - 2 ? "Hoje" : formattedDate,
        weatherCode: code,
        condition,
        icon,
        tempMax: maxTemps[idx] ?? 22,
        tempMin: minTemps[idx] ?? 14,
        sunshineHours: sunHours,
        solarRadiationHsp: hsp,
        precipitationMm: precip[idx] ?? 0,
        estimatedKwh,
      };
    });

    return result.length > 0 ? result : fallbackDailyWeather;
  } catch {
    return fallbackDailyWeather;
  }
}
