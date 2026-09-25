/**
 * Tipos e utilitários de clima (Open-Meteo) sem dependência de servidor, usados também em client components
 * A busca dos dados fica em lib/weatherData.ts
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
  isReal?: boolean; // true se veio da telemetria dos inversores (e não da estimativa por irradiação)
  realKwh?: number;
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


/** Série fixa observada em Içara/SC (28/08 a 04/09/2026), usada quando a chamada à Open-Meteo falha */
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
