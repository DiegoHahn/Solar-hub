import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SunCurveChart } from "./SunCurveChart";
import { buildSunCurveGrid } from "@/lib/queries";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import type { SunCurveRow } from "@/lib/queries";

describe("SunCurveChart", () => {
  const targetDate = "2026-09-29";
  const nighttime = new Date(`${targetDate}T22:00:00-03:00`);
  const dayCurve = buildSunCurveGrid(telemetryDayFixture as unknown as SunCurveRow[], targetDate, nighttime);

  it("renders chart without errors using daily grid points", () => {
    const { container } = render(<SunCurveChart data={dayCurve} nominalCapKw={16} />);

    expect(screen.getByText("Curva Solar de Hoje")).toBeInTheDocument();
    expect(screen.getByText(/Janela solar das 05:00 às 20:00 em tempo real/)).toBeInTheDocument();

    const rechartsContainer = container.querySelector(".recharts-responsive-container");
    expect(rechartsContainer).toBeInTheDocument();
  });

  it("returns null or handles empty array without breaking", () => {
    const { container } = render(<SunCurveChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
