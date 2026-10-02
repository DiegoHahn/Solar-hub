import { describe, expect, it } from "vitest";

import {
  buildMultiYearHistory,
  buildSunCurveGrid,
  mergeDailyGeneration,
  normalizeUnidadeConsumidora,
  type DailyGenerationRow,
  type InverterDailyHistoryRow,
  type SunCurveRow,
} from "./queries";
import type { UnidadeConsumidora, InverterMonthlyHistoryRow } from "./types";

import dailyGenFixture from "../test/fixtures/daily-generation.json";
import monthlyHistoryFixture from "../test/fixtures/monthly-history.json";
import telemetryDayFixtureRaw from "../test/fixtures/telemetry-day.json";
import utilityDataFixture from "../test/fixtures/utility-data.json";

const telemetryDayFixture = telemetryDayFixtureRaw as unknown as SunCurveRow[];

describe("normalizeUnidadeConsumidora", () => {
  it("normaliza balanço energético e extrato GD a partir dos dados crus da concessionária", () => {
    const rawUc = utilityDataFixture.unidades_consumidoras["UC-GERADORA"] as unknown as UnidadeConsumidora;
    const normalized = normalizeUnidadeConsumidora(rawUc);

    expect(normalized.balanco_energetico).toBeDefined();
    expect(normalized.balanco_energetico!.length).toBeGreaterThan(0);

    const firstBalanco = normalized.balanco_energetico![0];
    expect(firstBalanco).toHaveProperty("mes");
    expect(firstBalanco).toHaveProperty("injetado_kwh");
    expect(firstBalanco).toHaveProperty("compensado_kwh");
    expect(firstBalanco.liquido_kwh).toBe(firstBalanco.injetado_kwh - firstBalanco.compensado_kwh);
    expect(firstBalanco).toHaveProperty("saldo_kwh");

    expect(normalized.extrato_gd).toBeDefined();
    expect(normalized.extrato_gd!.length).toBeGreaterThan(0);
    const firstExtrato = normalized.extrato_gd![0];
    expect(["injetada", "compensada"]).toContain(firstExtrato.tipo);
    expect(firstExtrato).toHaveProperty("saldo");
    expect([1, 2]).toContain(firstExtrato.grupo);

    if (normalized.geracao_distribuida?.ProximoSaldoVencer) {
      expect(normalized.geracao_distribuida.ProximoSaldoVencer).not.toContain("00:00:00");
    }
  });

  it("preserva balanço e extrato caso já existam previamente normalizados", () => {
    const baseUc: UnidadeConsumidora = {
      codigo_uc: "UC-101",
      balanco_energetico: [
        { mes: "08/2026", injetado_kwh: 500, compensado_kwh: 300, liquido_kwh: 200, saldo_kwh: 6000 },
      ],
      extrato_gd: [{ tipo: "injetada", mes: "08/2026", kwh: 500, saldo: 6000, grupo: 1 }],
    };

    const res = normalizeUnidadeConsumidora(baseUc);
    expect(res.balanco_energetico).toEqual(baseUc.balanco_energetico);
    expect(res.extrato_gd).toEqual(baseUc.extrato_gd);
  });

  it("remove meses futuros/não faturados do final do array que vêm zerados da concessionária", () => {
    const ucWithTrailingZeros: UnidadeConsumidora = {
      codigo_uc: "UC-101",
      grafico_historico_12_meses: {
        RetornoDadosHistoricoGeracaoConsumoKwhNormal: [
          { AnoMes: "01/08/2026 00:00:00", KwhGerado: 1400, kwhCreditado: 600, Saldo: 9000 },
          { AnoMes: "01/09/2026 00:00:00", KwhGerado: 1450, kwhCreditado: 550, Saldo: 9900 },
          { AnoMes: "01/10/2026 00:00:00", KwhGerado: 0, kwhCreditado: 0, Saldo: 0 },
        ],
      },
    };

    const res = normalizeUnidadeConsumidora(ucWithTrailingZeros);
    expect(res.balanco_energetico).toHaveLength(2);
    expect(res.balanco_energetico![1].mes).toBe("09/2026");
    expect(res.balanco_energetico![1].saldo_kwh).toBe(9900);
  });
});

describe("buildSunCurveGrid", () => {
  const targetDate = "2026-09-29";

  it("gera grade fixa de 30 em 30 minutos das 05:00 às 20:00 (31 pontos)", () => {
    const nighttime = new Date(`${targetDate}T22:00:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, nighttime);

    expect(grid).toHaveLength(31);
    expect(grid[0].time).toBe("05:00");
    expect(grid[grid.length - 1].time).toBe("20:00");
    expect(grid.every((p) => p.nominal_cap_kw === 16.0)).toBe(true);
  });

  it("define como null os slots posteriores ao horário atual (now) durante o dia", () => {
    const afternoon = new Date(`${targetDate}T12:00:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, afternoon);

    const pastOrPresent = grid.filter((p) => p.time <= "12:00");
    const future = grid.filter((p) => p.time > "12:00");

    expect(pastOrPresent.every((p) => p.power_kw !== null)).toBe(true);
    expect(future.every((p) => p.power_kw === null)).toBe(true);
  });

  it("só preenche um slot depois que o horário dele chega", () => {
    const beforeFive = new Date(`${targetDate}T16:53:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, beforeFive);
    const slot = (time: string) => grid.find((p) => p.time === time)!;

    expect(slot("16:30").power_kw).not.toBeNull();
    expect(slot("17:00").power_kw).toBeNull();
  });

  it("mantém todos os slots preenchidos quando now é posterior às 20:00", () => {
    const night = new Date(`${targetDate}T21:30:00-03:00`);
    const grid = buildSunCurveGrid(telemetryDayFixture, targetDate, night);

    expect(grid.every((p) => p.power_kw !== null)).toBe(true);
  });
});

describe("mergeDailyGeneration", () => {
  it("sobrescreve a view de telemetria com os dados fechados do histórico diário", () => {
    const viewRows: DailyGenerationRow[] = [
      { date: "2026-08-27", kwh: 35.0 },
      { date: "2026-08-28", kwh: 40.0 },
    ];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "plant_total", kwh: 48.5, is_estimated: false },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 48.5, isReal: true });
    expect(merged["2026-08-28"]).toEqual({ kwh: 40.0, isReal: true });
  });

  it("marca isReal como false quando o registro de histórico foi calibrado/estimado", () => {
    const viewRows: DailyGenerationRow[] = [{ date: "2026-08-27", kwh: 30.0 }];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "plant_total", kwh: 45.0, is_estimated: true },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 45.0, isReal: false });
  });

  it("soma goodwe_combined + inv_1 quando plant_total não estiver presente no histórico", () => {
    const viewRows: DailyGenerationRow[] = [];
    const historyRows: InverterDailyHistoryRow[] = [
      { date: "2026-08-27", inverter_id: "inv_1", kwh: 20.0, is_estimated: false },
      { date: "2026-08-27", inverter_id: "goodwe_combined", kwh: 30.5, is_estimated: false },
    ];

    const merged = mergeDailyGeneration(viewRows, historyRows);
    expect(merged["2026-08-27"]).toEqual({ kwh: 50.5, isReal: true });
  });

  it("processa com sucesso os dados reais da fixture daily-generation.json", () => {
    const merged = mergeDailyGeneration(
      dailyGenFixture.view as DailyGenerationRow[],
      dailyGenFixture.history as InverterDailyHistoryRow[],
    );
    const dates = Object.keys(merged);
    expect(dates.length).toBeGreaterThan(30);

    for (const d of dates) {
      expect(merged[d].kwh).toBeGreaterThanOrEqual(0);
      expect(typeof merged[d].isReal).toBe("boolean");
    }
  });
});

describe("buildMultiYearHistory", () => {
  it("teste de regressão: o mês a partir de dailyFromMonth utiliza a soma diária em vez do valor parcial da tabela mensal", () => {
    const monthlyRows: InverterMonthlyHistoryRow[] = [
      { month: "2026-08", inverter_id: "plant_total", kwh: 1200 },
      { month: "2026-09", inverter_id: "plant_total", kwh: 300 }, // valor parcial/incompleto na tabela mensal
    ];

    const dailyEntries = {
      "2026-09-01": { kwh: 50, isReal: true },
      "2026-09-02": { kwh: 60, isReal: true },
      "2026-09-03": { kwh: 70, isReal: true },
    };

    const history = buildMultiYearHistory(monthlyRows, dailyEntries, "2026-09", "2026-09-29");

    // No ano de 2026, Setembro deve refletir a soma dos dias (50 + 60 + 70 = 180), e não os 300 parciais
    const points2026 = history.byYear["2026"];
    expect(points2026).toBeDefined();

    const sepPoint = points2026.find((p) => p.label === "Set");
    expect(sepPoint?.kwh).toBe(180);

    const augPoint = points2026.find((p) => p.label === "Ago");
    expect(augPoint?.kwh).toBe(1200);
  });

  it("monta histórico plurianual consistente com os dados reais de monthly-history e daily-generation", () => {
    const monthlyRows = monthlyHistoryFixture as InverterMonthlyHistoryRow[];
    const dailyEntries = mergeDailyGeneration(
      dailyGenFixture.view as DailyGenerationRow[],
      dailyGenFixture.history as InverterDailyHistoryRow[],
    );

    const history = buildMultiYearHistory(monthlyRows, dailyEntries, "2026-09", "2026-09-29");

    expect(history.last12Months).toHaveLength(12);
    expect(history.availableYears.length).toBeGreaterThanOrEqual(1);
    expect(history.yearsTotals.length).toBeGreaterThanOrEqual(1);

    for (const p of history.last12Months) {
      expect(p.kwh).toBeGreaterThanOrEqual(0);
    }
  });
});
