import { describe, expect, it } from "vitest";
import { getIcaraWeatherData } from "@/lib/weatherData";

describe("External API Integration — Real Open-Meteo", () => {
  const QUERY =
    "latitude=-28.7139&longitude=-49.3003&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,shortwave_radiation_sum,precipitation_sum&tilt=15&azimuth=155&timezone=America%2FSao_Paulo";

  it("Open-Meteo Forecast responds with status 200 and expected daily fields", async () => {
    const url = `https://api.open-meteo.com/v1/forecast?${QUERY}&past_days=7&forecast_days=1`;
    const res = await fetch(url);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.daily).toBeDefined();
    expect(data.daily.time.length).toBeGreaterThanOrEqual(8);
    expect(data.daily.temperature_2m_max.length).toBe(data.daily.time.length);
    expect(data.daily.shortwave_radiation_sum.length).toBe(data.daily.time.length);

    for (let i = 0; i < 7; i++) {
      expect(data.daily.temperature_2m_max[i]).not.toBeNull();
      expect(data.daily.shortwave_radiation_sum[i]).not.toBeNull();
    }
  });

  it("Open-Meteo Archive responds with status 200 for historical window (70 to 80 days ago)", async () => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - 80 * dayMs).toISOString().slice(0, 10);
    const end = new Date(now.getTime() - 70 * dayMs).toISOString().slice(0, 10);

    const url = `https://archive-api.open-meteo.com/v1/archive?${QUERY}&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.daily).toBeDefined();
    expect(data.daily.time.length).toBeGreaterThanOrEqual(10);
    expect(data.daily.shortwave_radiation_sum[0]).not.toBeNull();
  });

  it("getIcaraWeatherData executes end-to-end returning plant weather history", async () => {
    const weather = await getIcaraWeatherData();

    expect(Array.isArray(weather)).toBe(true);
    expect(weather.length).toBeGreaterThanOrEqual(80);

    const today = weather[weather.length - 1];
    expect(today.formattedDate).toBe("Hoje");
    expect(typeof today.solarRadiationHsp).toBe("number");
    expect(today.solarRadiationHsp).toBeGreaterThanOrEqual(0);
    expect(typeof today.estimatedKwh).toBe("number");
    expect(today.condition).toBeDefined();
    expect(today.icon).toBeDefined();
  });
});
