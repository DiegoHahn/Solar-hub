import { describe, expect, it } from "vitest";
import type { UnidadeConsumidora, UtilityDataRow } from "./types";
import { en } from "@/i18n/locales/en";
import { ptBR } from "@/i18n/locales/pt-BR";
import {
  findGeneratorUcCode,
  getGeneratorUc,
  holderFirstName,
  maskUcCode,
  tariffFlagVariant,
  translateTariffFlag,
} from "./utility";

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
  it("identifies generating consumer unit by installed DG capacity (> 0)", () => {
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

  it("falls back to 'Energia injetada' operation in DG statement when capacity is unspecified", () => {
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

  it("returns null when no consumer unit has installed capacity or injected energy", () => {
    const unidades: Record<string, UnidadeConsumidora> = {
      "1001": createMockUc({ codigo_uc: "1001" }),
      "1002": createMockUc({ codigo_uc: "1002" }),
    };

    expect(findGeneratorUcCode(unidades)).toBeNull();
  });

  it("returns null when consumer units map is empty or undefined", () => {
    expect(findGeneratorUcCode(undefined)).toBeNull();
    expect(findGeneratorUcCode({})).toBeNull();
  });
});

describe("getGeneratorUc", () => {
  it("returns consumer unit mapped by generator_uc", () => {
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

  it("returns undefined when generator_uc does not exist or utilityData is null", () => {
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

describe("maskUcCode", () => {
  it("keeps only the last 4 digits visible", () => {
    expect(maskUcCode("9876543210")).toBe("••••3210");
  });

  it("displays em-dash when empty and does not mask short codes", () => {
    expect(maskUcCode(null)).toBe("—");
    expect(maskUcCode("")).toBe("—");
    expect(maskUcCode("123")).toBe("123");
  });
});

describe("holderFirstName", () => {
  it("returns only capitalized first name", () => {
    expect(holderFirstName("MARIA DA SILVA SANTOS")).toBe("Maria");
    expect(holderFirstName("  joão pereira ")).toBe("João");
  });

  it("returns empty string when name is undefined", () => {
    expect(holderFirstName(undefined)).toBe("");
  });
});

describe("tariff flag", () => {
  it("maps the reported flag to a badge color", () => {
    expect(tariffFlagVariant("Bandeira verde")).toBe("success");
    expect(tariffFlagVariant("Bandeira amarela")).toBe("warning");
    expect(tariffFlagVariant("Bandeira vermelha - Patamar 1")).toBe("error");
    expect(tariffFlagVariant(undefined)).toBe("neutral");
  });

  it("translates the reported flag and keeps unknown values as reported", () => {
    expect(translateTariffFlag("Bandeira amarela", en)).toBe(en.utility.flagYellow);
    expect(translateTariffFlag("Bandeira amarela", ptBR)).toBe("Bandeira amarela");
    expect(translateTariffFlag("Tarifa especial", en)).toBe("Tarifa especial");
    expect(translateTariffFlag(undefined, en)).toBe("");
  });
});
