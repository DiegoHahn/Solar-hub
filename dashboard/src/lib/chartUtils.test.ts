import { describe, expect, it } from "vitest";
import type { MouseHandlerDataParam } from "recharts";
import {
  constructCategoryColors,
  getActiveDatum,
  getColorClassName,
  getYAxisDomain,
  hasOnlyOneValueForKey,
} from "./chartUtils";

const state = (activeIndex: MouseHandlerDataParam["activeIndex"]): MouseHandlerDataParam => ({
  activeIndex,
  activeTooltipIndex: activeIndex,
  isTooltipActive: activeIndex !== undefined,
  activeLabel: undefined,
  activeDataKey: undefined,
  activeCoordinate: undefined,
});

describe("getActiveDatum", () => {
  const data = [{ kwh: 10 }, { kwh: 20 }, { kwh: 30 }];

  it("retorna o item do índice ativo", () => {
    expect(getActiveDatum(state(1), data)).toEqual({ kwh: 20 });
  });

  it("aceita índice como string (TooltipIndex do Recharts)", () => {
    expect(getActiveDatum(state("2"), data)).toEqual({ kwh: 30 });
  });

  it("retorna undefined sem índice ativo, com índice inválido ou fora do array", () => {
    expect(getActiveDatum(state(undefined), data)).toBeUndefined();
    expect(getActiveDatum(state(null), data)).toBeUndefined();
    expect(getActiveDatum(state("abc"), data)).toBeUndefined();
    expect(getActiveDatum(state(10), data)).toBeUndefined();
    expect(getActiveDatum(undefined, data)).toBeUndefined();
  });
});

describe("constructCategoryColors", () => {
  it("atribui cores em ordem e recicla quando há mais categorias que cores", () => {
    const map = constructCategoryColors(["a", "b", "c"], ["blue", "amber"]);
    expect(map.get("a")).toBe("blue");
    expect(map.get("b")).toBe("amber");
    expect(map.get("c")).toBe("blue");
  });
});

describe("getColorClassName", () => {
  it("retorna a classe Tailwind da cor e do utilitário", () => {
    expect(getColorClassName("emerald", "fill")).toBe("fill-emerald-500");
  });

  it("cai para cinza quando a cor não existe", () => {
    // @ts-expect-error cor inválida de propósito
    expect(getColorClassName("inexistente", "bg")).toBe("bg-gray-500");
  });
});

describe("getYAxisDomain", () => {
  it("usa 'auto' no mínimo quando autoMinValue está ligado", () => {
    expect(getYAxisDomain(true, 5, 100)).toEqual(["auto", 100]);
  });

  it("usa 0 e 'auto' como padrões", () => {
    expect(getYAxisDomain(false, undefined, undefined)).toEqual([0, "auto"]);
  });
});

describe("hasOnlyOneValueForKey", () => {
  it("é verdadeiro quando a chave aparece no máximo uma vez", () => {
    expect(hasOnlyOneValueForKey([{ a: 1 }, { b: 2 }], "a")).toBe(true);
    expect(hasOnlyOneValueForKey([], "a")).toBe(true);
  });

  it("é falso quando a chave aparece mais de uma vez", () => {
    expect(hasOnlyOneValueForKey([{ a: 1 }, { a: 2 }], "a")).toBe(false);
  });
});
