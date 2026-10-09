import { describe, expect, it } from "vitest";

import { normalizeUnidadeConsumidora } from "./utility";
import type { UnidadeConsumidora } from "../types";

import utilityDataFixture from "../../test/fixtures/utility-data.json";

describe("normalizeUnidadeConsumidora", () => {
  it("normalizes energy balance and DG extract from raw utility data", () => {
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

  it("leaves balance, capacity and allocation undefined when no source reports them", () => {
    const normalized = normalizeUnidadeConsumidora({ codigo_uc: "UC-101", geracao_distribuida: {} } as UnidadeConsumidora);

    expect(normalized.geracao_distribuida?.ValorProximoSaldoVencer).toBeUndefined();
    expect(normalized.geracao_distribuida?.PotenciaInstalada).toBeUndefined();
    expect(normalized.geracao_distribuida?.PercentualFatUcGeradora).toBeUndefined();
  });

  it("takes the balance from the GD statement when the portal omits it", () => {
    const normalized = normalizeUnidadeConsumidora({
      codigo_uc: "UC-101",
      geracao_distribuida: {},
      extrato_historico_gd: {
        RetornoDadosHistoricoGeracaoKwhNormal: [
          { Operacao: "Energia injetada", MesFaturamento: "01/09/2026 00:00:00", KwhGerado: 900, kwhCreditado: 0, Saldo: 4321 },
        ],
      },
    } as unknown as UnidadeConsumidora);

    expect(normalized.geracao_distribuida?.ValorProximoSaldoVencer).toBe(4321);
  });

  it("keeps a zero balance reported by the portal", () => {
    const normalized = normalizeUnidadeConsumidora({
      codigo_uc: "UC-101",
      geracao_distribuida: { ValorProximoSaldoVencer: 0, PotenciaInstalada: 16, PercentualFatUcGeradora: 100 },
      extrato_historico_gd: {
        RetornoDadosHistoricoGeracaoKwhNormal: [
          { Operacao: "Energia injetada", MesFaturamento: "01/09/2026 00:00:00", KwhGerado: 900, kwhCreditado: 0, Saldo: 4321 },
        ],
      },
    } as unknown as UnidadeConsumidora);

    expect(normalized.geracao_distribuida?.ValorProximoSaldoVencer).toBe(0);
  });

  it("preserves balance and extract if already previously normalized", () => {
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

  it("removes trailing unbilled/future zeroed months provided by utility", () => {
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
