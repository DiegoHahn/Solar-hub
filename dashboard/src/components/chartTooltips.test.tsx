import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SunCurveTooltip } from "./SunCurveChart";
import { InverterCurveTooltip } from "./InverterCurveChart";
import { EnergyBalanceTooltip } from "./EnergyBalanceChart";
import { GenerationTooltip } from "./GenerationBarChart";
import { WeatherTooltip } from "./WeatherEfficiencySection";
import { buildSunCurveGrid, normalizeUnidadeConsumidora, type SunCurveRow } from "@/lib/queries";
import { parseWmoCode, type DailyWeather } from "@/lib/weather";
import { ptBR } from "@/i18n/locales/pt-BR";
import type { UnidadeConsumidora } from "@/lib/types";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import utilityDataFixture from "../test/fixtures/utility-data.json";

const noonCurve = buildSunCurveGrid(
  telemetryDayFixture as unknown as SunCurveRow[],
  "2026-09-29",
  new Date("2026-09-29T22:00:00-03:00"),
);
const sunPoint = noonCurve.reduce((max, p) => ((p.power_kw ?? 0) > (max.power_kw ?? 0) ? p : max));
const balance = normalizeUnidadeConsumidora(
  utilityDataFixture.unidades_consumidoras["UC-GERADORA"] as unknown as UnidadeConsumidora,
).balanco_energetico!;
const balanceMonth = balance[balance.length - 1];
const weatherDay: DailyWeather = {
  date: "2026-08-28",
  isToday: false,
  weatherCode: 80,
  ...parseWmoCode(80),
  tempMax: 27.2,
  tempMin: 17.0,
  sunshineHours: 2.1,
  solarRadiationHsp: 1.73,
  precipitationMm: 4.2,
  estimatedKwh: 22.8,
};

describe("chart tooltips", () => {
  it("sun curve: displays time and total power and notifies active point", () => {
    const onActivePoint = vi.fn();
    const { container } = render(
      <SunCurveTooltip
        active
        payload={[{ payload: sunPoint }]}
        label={sunPoint.time}
        nominalCapKw={16}
        onActivePoint={onActivePoint}
      />,
    );

    expect(container.textContent).toContain(sunPoint.time);
    expect(container.textContent).toContain("Total Power:");
    expect(onActivePoint).toHaveBeenCalledWith(sunPoint);
  });

  it("sun curve: does not render or notify when inactive or lacking power", () => {
    const onActivePoint = vi.fn();
    const inactive = render(<SunCurveTooltip active={false} nominalCapKw={16} onActivePoint={onActivePoint} />);
    const noPower = render(
      <SunCurveTooltip active payload={[{ payload: { ...sunPoint, power_kw: null } }]} nominalCapKw={16} />,
    );

    expect(inactive.container.firstChild).toBeNull();
    expect(noPower.container.firstChild).toBeNull();
    expect(onActivePoint).not.toHaveBeenCalled();
  });

  it("inverter curve: lists power for each series at timestamp", () => {
    const onActivePoint = vi.fn();
    const payload = [
      { dataKey: "solis_kw", value: sunPoint.solis_kw ?? 0, color: "#f59e0b", payload: sunPoint },
      { dataKey: "goodwe1_kw", value: sunPoint.goodwe1_kw ?? 0, color: "#3b82f6", payload: sunPoint },
    ];
    const { container } = render(
      <InverterCurveTooltip active payload={payload} label={sunPoint.time} onActivePoint={onActivePoint} />,
    );

    expect(container.textContent).toContain(sunPoint.time);
    expect(onActivePoint).toHaveBeenCalledWith(sunPoint);
  });

  it("energy balance: displays month and injection and compensation values", () => {
    const onActivePoint = vi.fn();
    const { container } = render(
      <EnergyBalanceTooltip active payload={[{ payload: balanceMonth }]} onActivePoint={onActivePoint} />,
    );

    expect(container.textContent).toContain(balanceMonth.mes.split("/")[1]);
    expect(onActivePoint).toHaveBeenCalledWith(balanceMonth);
    expect(render(<EnergyBalanceTooltip active={false} />).container.firstChild).toBeNull();
  });

  it("generation by period: displays label and unit", () => {
    const point = { label: "Set", kwh: 2072.7 };
    const onActivePoint = vi.fn();
    const { container } = render(
      <GenerationTooltip active payload={[{ payload: point }]} unitLabel="kWh" onActivePoint={onActivePoint} />,
    );

    expect(container.textContent).toContain("Set");
    expect(container.textContent).toContain("kWh");
    expect(onActivePoint).toHaveBeenCalledWith(point);
    expect(render(<GenerationTooltip unitLabel="kWh" />).container.firstChild).toBeNull();
  });

  it("weather: displays date and condition of the day", () => {
    const onActivePoint = vi.fn();
    const renderIcon = vi.fn(() => <span data-testid="icone" />);
    const { container, getByTestId } = render(
      <WeatherTooltip active payload={[{ payload: weatherDay }]} onActivePoint={onActivePoint} renderIcon={renderIcon} />,
    );

    expect(container.textContent).toContain("28/08");
    expect(container.textContent).toContain(ptBR.weather[weatherDay.conditionKey]);
    expect(getByTestId("icone")).toBeInTheDocument();
    expect(onActivePoint).toHaveBeenCalledWith(weatherDay);
  });
});
