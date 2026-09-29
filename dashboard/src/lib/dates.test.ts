import { describe, expect, it } from "vitest";
import { brasiliaClock, brasiliaIsoDaysAgo, toBrasiliaIsoDate } from "./dates";

describe("toBrasiliaIsoDate", () => {
  it("converte data UTC para o dia correto no fuso de Brasília", () => {
    // 15:00 UTC = 12:00 BRT
    const date = new Date("2026-06-15T15:00:00Z");
    expect(toBrasiliaIsoDate(date)).toBe("2026-06-15");
  });

  it("mantém a data de Brasília na virada da noite (23:30 BRT = 02:30 UTC do dia seguinte)", () => {
    const lateNightBrt = new Date("2026-06-15T23:30:00-03:00");
    expect(toBrasiliaIsoDate(lateNightBrt)).toBe("2026-06-15");
  });

  it("reconhece o novo dia logo após a meia-noite em Brasília (00:15 BRT = 03:15 UTC)", () => {
    const earlyMorningBrt = new Date("2026-06-16T00:15:00-03:00");
    expect(toBrasiliaIsoDate(earlyMorningBrt)).toBe("2026-06-16");
  });
});

describe("brasiliaClock", () => {
  it("formata hora e minutos em h23", () => {
    const date = new Date("2026-06-15T14:05:00-03:00");
    expect(brasiliaClock(date).time).toBe("14:05");
  });

  it.each([
    ["05:59", new Date("2026-06-15T05:59:00-03:00"), false],
    ["06:00", new Date("2026-06-15T06:00:00-03:00"), true],
    ["12:00", new Date("2026-06-15T12:00:00-03:00"), true],
    ["18:59", new Date("2026-06-15T18:59:59-03:00"), true],
    ["19:00", new Date("2026-06-15T19:00:00-03:00"), false],
    ["23:30", new Date("2026-06-15T23:30:00-03:00"), false],
    ["00:00", new Date("2026-06-15T00:00:00-03:00"), false],
  ])("no horário %s define isDaytime como %s", (_, date, expectedDaytime) => {
    const clock = brasiliaClock(date);
    expect(clock.isDaytime).toBe(expectedDaytime);
  });
});

describe("brasiliaIsoDaysAgo", () => {
  const base = new Date("2026-01-03T12:00:00-03:00");

  it("retorna o próprio dia quando days é 0", () => {
    expect(brasiliaIsoDaysAgo(0, base)).toBe("2026-01-03");
  });

  it("calcula dias retroativos no mesmo mês", () => {
    expect(brasiliaIsoDaysAgo(2, base)).toBe("2026-01-01");
  });

  it("calcula dias retroativos na virada de ano", () => {
    expect(brasiliaIsoDaysAgo(4, base)).toBe("2025-12-30");
  });
});
