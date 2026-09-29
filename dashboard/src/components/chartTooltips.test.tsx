import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SunCurveTooltip } from "./SunCurveChart";
import { InverterCurveTooltip } from "./InverterCurveChart";
import { EnergyBalanceTooltip } from "./EnergyBalanceChart";
import { GenerationTooltip } from "./GenerationBarChart";
import { WeatherTooltip } from "./WeatherEfficiencySection";
import { buildSunCurveGrid, normalizeUnidadeConsumidora, type SunCurveRow } from "@/lib/queries";
import { fallbackDailyWeather } from "@/lib/weather";
import type { UnidadeConsumidora } from "@/lib/types";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";
import utilityDataFixture from "../test/fixtures/utility-data.json";

const noonCurve = buildSunCurveGrid(
  telemetryDayFixture as unknown as SunCurveRow[],
  "2026-09-29",
  new Date("2026-09-29T22:00:00-03:00"),
);
const sunPoint = noonCurve.reduce((max, p) => ((p.power_kw ?? 0) > (max.power_kw ?? 0) ? p : max));
const balanco = normalizeUnidadeConsumidora(
  utilityDataFixture.unidades_consumidoras["UC-GERADORA"] as unknown as UnidadeConsumidora,
).balanco_energetico!;
const balancoMes = balanco[balanco.length - 1];
const weatherDay = fallbackDailyWeather[0];

describe("tooltips dos gráficos", () => {
  it("curva solar: mostra o horário e a potência total e avisa o ponto ativo", () => {
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
    expect(container.textContent).toContain("Potência Total");
    expect(onActivePoint).toHaveBeenCalledWith(sunPoint);
  });

  it("curva solar: não renderiza nem avisa quando inativo ou sem potência", () => {
    const onActivePoint = vi.fn();
    const inactive = render(<SunCurveTooltip active={false} nominalCapKw={16} onActivePoint={onActivePoint} />);
    const noPower = render(
      <SunCurveTooltip active payload={[{ payload: { ...sunPoint, power_kw: null } }]} nominalCapKw={16} />,
    );

    expect(inactive.container.firstChild).toBeNull();
    expect(noPower.container.firstChild).toBeNull();
    expect(onActivePoint).not.toHaveBeenCalled();
  });

  it("curva por inversor: lista a potência de cada série no horário", () => {
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

  it("balanço energético: mostra o mês e os valores de injeção e compensação", () => {
    const onActivePoint = vi.fn();
    const { container } = render(
      <EnergyBalanceTooltip active payload={[{ payload: balancoMes }]} onActivePoint={onActivePoint} />,
    );

    expect(container.textContent).toContain(balancoMes.mes.split("/")[1]);
    expect(onActivePoint).toHaveBeenCalledWith(balancoMes);
    expect(render(<EnergyBalanceTooltip active={false} />).container.firstChild).toBeNull();
  });

  it("geração por período: mostra o rótulo e a unidade", () => {
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

  it("clima: mostra a data e a condição do dia", () => {
    const onActivePoint = vi.fn();
    const renderIcon = vi.fn(() => <span data-testid="icone" />);
    const { container, getByTestId } = render(
      <WeatherTooltip active payload={[{ payload: weatherDay }]} onActivePoint={onActivePoint} renderIcon={renderIcon} />,
    );

    expect(container.textContent).toContain(weatherDay.formattedDate);
    expect(container.textContent).toContain(weatherDay.condition);
    expect(getByTestId("icone")).toBeInTheDocument();
    expect(onActivePoint).toHaveBeenCalledWith(weatherDay);
  });
});
