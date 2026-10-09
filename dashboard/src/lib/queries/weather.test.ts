import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWeatherRow } from "../types";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { getStoredDailyWeather, saveDailyWeather } from "./weather";

const row: DailyWeatherRow = {
  date: "2026-09-29",
  weather_code: 1,
  temperature_max_c: 26,
  temperature_min_c: 14,
  sunshine_duration_s: 36000,
  shortwave_radiation_mj: 20,
  tilted_radiation_kwh: 6.1,
  precipitation_mm: 0,
  source: "forecast",
};

describe("getStoredDailyWeather", () => {
  beforeEach(() => mockFrom.mockReset());

  function mockSelect(result: { data: DailyWeatherRow[] | null; error: unknown }) {
    const order = vi.fn().mockResolvedValue(result);
    const gte = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ gte }));
    mockFrom.mockReturnValue({ select });
    return { select, gte, order };
  }

  it("reads days from the start date in chronological order", async () => {
    const { gte, order } = mockSelect({ data: [row], error: null });

    await expect(getStoredDailyWeather("2026-07-01")).resolves.toEqual([row]);
    expect(mockFrom).toHaveBeenCalledWith("daily_weather");
    expect(gte).toHaveBeenCalledWith("date", "2026-07-01");
    expect(order).toHaveBeenCalledWith("date", { ascending: true });
  });

  it("returns an empty list when the query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSelect({ data: null, error: { message: "boom" } });

    await expect(getStoredDailyWeather("2026-07-01")).resolves.toEqual([]);
  });
});

describe("saveDailyWeather", () => {
  beforeEach(() => mockFrom.mockReset());

  it("does not touch the database when there is nothing to save", async () => {
    await saveDailyWeather([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("upserts rows by date with an update timestamp", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });

    await saveDailyWeather([row]);

    expect(upsert).toHaveBeenCalledWith([{ ...row, updated_at: expect.any(String) }], { onConflict: "date" });
  });

  it("logs and swallows write errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: "denied" } }) });

    await expect(saveDailyWeather([row])).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Error saving daily_weather:", { message: "denied" });
  });
});
