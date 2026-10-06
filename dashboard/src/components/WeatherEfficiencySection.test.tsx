import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeatherEfficiencySection } from "./WeatherEfficiencySection";
import { toDailyWeather } from "@/lib/weatherData";
import weatherFixture from "@/test/fixtures/daily-weather.json";
import type { DailyWeatherRow } from "@/lib/types";

describe("WeatherEfficiencySection", () => {
  const todayIso = "2026-09-29";
  const dailyWeatherList = (weatherFixture as DailyWeatherRow[]).slice(0, 30).map((row) =>
    toDailyWeather(row, todayIso, undefined),
  );

  it("renders full header, badges, and aggregated statistics in default view", () => {
    render(<WeatherEfficiencySection weatherData={dailyWeatherList} compact={false} />);

    expect(screen.getByRole("heading", { name: "Índice Climático vs. Eficiência Solar" })).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo · Içara\/SC/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "7 Dias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 Dias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90 Dias" })).toBeInTheDocument();

    expect(screen.getByText(/Sol \(HSP\)/i)).toBeInTheDocument();
  });

  it("allows toggling between 7, 30, and 90 day filters", () => {
    render(<WeatherEfficiencySection weatherData={dailyWeatherList} compact={false} />);

    const btn30 = screen.getByRole("button", { name: "30 Dias" });
    fireEvent.click(btn30);
    expect(btn30).toHaveClass("bg-white");

    const btn90 = screen.getByRole("button", { name: "90 Dias" });
    fireEvent.click(btn90);
    expect(btn90).toHaveClass("bg-white");

    const btn7 = screen.getByRole("button", { name: "7 Dias" });
    fireEvent.click(btn7);
    expect(btn7).toHaveClass("bg-white");
  });

  it("renders compact version for overview dashboard", () => {
    render(<WeatherEfficiencySection weatherData={dailyWeatherList} compact={true} />);

    expect(screen.getByRole("heading", { name: "Sol vs. Geração (Últimos 7 dias)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "30 Dias" })).not.toBeInTheDocument();
  });
});
