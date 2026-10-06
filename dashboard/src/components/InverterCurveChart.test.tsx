import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InverterCurveChart } from "./InverterCurveChart";
import { buildSunCurveGrid } from "@/lib/queries";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import type { SunCurveRow } from "@/lib/queries";

describe("InverterCurveChart", () => {
  const targetDate = "2026-09-29";
  const nighttime = new Date(`${targetDate}T22:00:00-03:00`);
  const dayCurve = buildSunCurveGrid(telemetryDayFixture as unknown as SunCurveRow[], targetDate, nighttime);

  it("renders inverter contribution chart without errors", () => {
    const { container } = render(<InverterCurveChart data={dayCurve} />);

    expect(screen.getByText("Contribuição por Inversor")).toBeInTheDocument();
    expect(screen.getByText(/Janela solar das 05:00 às 20:00 em tempo real/)).toBeInTheDocument();

    const rechartsContainer = container.querySelector(".recharts-responsive-container");
    expect(rechartsContainer).toBeInTheDocument();
  });

  it("returns null when data array is empty", () => {
    const { container } = render(<InverterCurveChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
