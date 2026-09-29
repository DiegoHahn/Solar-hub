import { describe, expect, it } from "vitest";
import type { UnidadeConsumidora, UtilityDataRow } from "./types";
import { findGeneratorUcCode, getGeneratorUc } from "./utility";

const createMockUc = (overrides: Partial<UnidadeConsumidora> = {}): UnidadeConsumidora => ({
  codigo_uc: "UC-101",
  ...overrides,
});

const createMockUtilityRow = (overrides: Partial<UtilityDataRow> = {}): UtilityDataRow =>
  ({
    id: 1,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    distribuidora: "Cooperaliança",
    titular: "Titular Teste",
    tarifa_referencia: null,
    unidades_consumidoras: {},
    ...overrides,
  }) as UtilityDataRow;

describe("findGeneratorUcCode", () => {
  it("identifica a UC geradora pela potência instalada de GD (> 0)", () => {
    const unidades: Record<string, UnidadeConsumidora> = {
      "1001": createMockUc({ codigo_uc: "1001" }),
      "1002": createMockUc({
        codigo_uc: "1002",
        geracao_distribuida: {
          PotenciaInstalada: 16.0,
          PercentualFatUcGeradora: 100,
          ProximoSaldoVencer: "01/01/2030",
          ValorProximoSaldoVencer: 0,
        },
      }),
      "1003": createMockUc({ codigo_uc: "1003" }),
    };

    expect(findGeneratorUcCode(unidades)).toBe("1002");
  });

  it("utiliza fallback por operação de 'Energia injetada' no extrato de GD quando não há potência informada", () => {
    const unidades: Record<string, UnidadeConsumidora> = {
      "1001": createMockUc({
        codigo_uc: "1001",
        extrato_historico_gd: {
          RetornoDadosHistoricoGeracaoKwhNormal: [
            {
              Operacao: "Energia faturada compensada",
              KwhGerado: 100,
              kwhCreditado: 0,
              Saldo: 80,
            },
          ],
        },
      }),
      "1002": createMockUc({
        codigo_uc: "1002",
        extrato_historico_gd: {
          RetornoDadosHistoricoGeracaoKwhNormal: [
            {
              Operacao: "Energia injetada na rede",
              KwhGerado: 5000,
              kwhCreditado: 1200,
              Saldo: 6200,
            },
          ],
        },
      }),
    };

    expect(findGeneratorUcCode(unidades)).toBe("1002");
  });

  it("retorna null quando nenhuma UC possui potência nem energia injetada", () => {
    const unidades: Record<string, UnidadeConsumidora> = {
      "1001": createMockUc({ codigo_uc: "1001" }),
      "1002": createMockUc({ codigo_uc: "1002" }),
    };

    expect(findGeneratorUcCode(unidades)).toBeNull();
  });

  it("retorna null quando a lista de unidades é vazia ou undefined", () => {
    expect(findGeneratorUcCode(undefined)).toBeNull();
    expect(findGeneratorUcCode({})).toBeNull();
  });
});

describe("getGeneratorUc", () => {
  it("retorna a unidade consumidora mapeada por generator_uc", () => {
    const ucGeradora = createMockUc({
      codigo_uc: "1002",
      geracao_distribuida: {
        PotenciaInstalada: 16,
        PercentualFatUcGeradora: 100,
        ProximoSaldoVencer: "01/01/2030",
        ValorProximoSaldoVencer: 0,
      },
    });
    const row = createMockUtilityRow({
      generator_uc: "1002",
      unidades_consumidoras: {
        "1001": createMockUc({ codigo_uc: "1001" }),
        "1002": ucGeradora,
      },
    });

    expect(getGeneratorUc(row)).toEqual(ucGeradora);
  });

  it("retorna undefined quando generator_uc não existe ou utilityData é nulo", () => {
    expect(getGeneratorUc(null)).toBeUndefined();
    expect(getGeneratorUc(undefined)).toBeUndefined();

    const rowSemGenerator = createMockUtilityRow({
      generator_uc: null,
      unidades_consumidoras: {
        "1001": createMockUc({ codigo_uc: "1001" }),
      },
    });
    expect(getGeneratorUc(rowSemGenerator)).toBeUndefined();
  });
});
