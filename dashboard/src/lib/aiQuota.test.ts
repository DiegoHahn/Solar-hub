import { describe, expect, it } from "vitest";
import { getBrasiliaDate, isPrimaryModel } from "./aiQuota";

describe("getBrasiliaDate", () => {
  it("converte data UTC para o dia correto no fuso de Brasília", () => {
    const utcNoon = new Date("2026-07-20T15:00:00Z"); // 12:00 BRT
    expect(getBrasiliaDate(utcNoon)).toBe("2026-07-20");
  });

  it("mantém a data do dia corrente às 23:30 em Brasília (02:30 UTC do dia seguinte)", () => {
    const lateNightBrt = new Date("2026-07-20T23:30:00-03:00");
    expect(getBrasiliaDate(lateNightBrt)).toBe("2026-07-20");
  });

  it("vira a data imediatamente após a meia-noite em Brasília (00:05 BRT = 03:05 UTC)", () => {
    const earlyMorningBrt = new Date("2026-07-21T00:05:00-03:00");
    expect(getBrasiliaDate(earlyMorningBrt)).toBe("2026-07-21");
  });
});

describe("isPrimaryModel", () => {
  const PRIMARY = "gemini-3.8-flash";

  it("reconhece quando os nomes são idênticos", () => {
    expect(isPrimaryModel("gemini-3.8-flash", PRIMARY)).toBe(true);
  });

  it("ignora diferenças de maiúsculas/minúsculas e espaços laterais", () => {
    expect(isPrimaryModel("  GEMINI-3.8-FLASH  ", PRIMARY)).toBe(true);
    expect(isPrimaryModel("Gemini-3.8-Flash", " gemini-3.8-flash ")).toBe(true);
  });

  it("aceita sufixos e prefixos usuais de versão e namespace", () => {
    expect(isPrimaryModel("models/gemini-3.8-flash", PRIMARY)).toBe(true);
    expect(isPrimaryModel("gemini-3.8-flash-latest", PRIMARY)).toBe(true);
    expect(isPrimaryModel("gemini-3.8-flash-001", PRIMARY)).toBe(true);
  });

  it("retorna falso para modelos visivelmente distintos", () => {
    expect(isPrimaryModel("gemini-1.5-flash", PRIMARY)).toBe(false);
    expect(isPrimaryModel("gemini-3.8-pro", PRIMARY)).toBe(false);
    expect(isPrimaryModel("gpt-4o", PRIMARY)).toBe(false);
  });
});
