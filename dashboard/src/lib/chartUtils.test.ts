import { describe, expect, it } from "vitest";
import type { MouseHandlerDataParam } from "recharts";
import {
  constructCategoryColors,
  getActiveDatum,
  getColorClassName,
  getInverterCurveYAxisConfig,
  getSunCurveYAxisConfig,
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

  it("returns the item for the active index", () => {
    expect(getActiveDatum(state(1), data)).toEqual({ kwh: 20 });
  });

  it("accepts index as string (Recharts TooltipIndex)", () => {
    expect(getActiveDatum(state("2"), data)).toEqual({ kwh: 30 });
  });

  it("returns undefined without active index, invalid index, or out-of-bounds index", () => {
    expect(getActiveDatum(state(undefined), data)).toBeUndefined();
    expect(getActiveDatum(state(null), data)).toBeUndefined();
    expect(getActiveDatum(state("abc"), data)).toBeUndefined();
    expect(getActiveDatum(state(10), data)).toBeUndefined();
    expect(getActiveDatum(undefined, data)).toBeUndefined();
  });
});

describe("constructCategoryColors", () => {
  it("assigns colors in order and cycles when categories exceed available colors", () => {
    const map = constructCategoryColors(["a", "b", "c"], ["blue", "amber"]);
    expect(map.get("a")).toBe("blue");
    expect(map.get("b")).toBe("amber");
    expect(map.get("c")).toBe("blue");
  });
});

describe("getColorClassName", () => {
  it("returns Tailwind class for color and utility", () => {
    expect(getColorClassName("emerald", "fill")).toBe("fill-emerald-500");
  });

  it("falls back to gray when color does not exist", () => {
    // @ts-expect-error deliberately invalid color
    expect(getColorClassName("inexistente", "bg")).toBe("bg-gray-500");
  });
});

describe("getYAxisDomain", () => {
  it("uses 'auto' as minimum when autoMinValue is enabled", () => {
    expect(getYAxisDomain(true, 5, 100)).toEqual(["auto", 100]);
  });

  it("uses 0 and 'auto' as defaults", () => {
    expect(getYAxisDomain(false, undefined, undefined)).toEqual([0, "auto"]);
  });
});

describe("hasOnlyOneValueForKey", () => {
  it("returns true when key appears at most once", () => {
    expect(hasOnlyOneValueForKey([{ a: 1 }, { b: 2 }], "a")).toBe(true);
    expect(hasOnlyOneValueForKey([], "a")).toBe(true);
  });

  it("returns false when key appears more than once", () => {
    expect(hasOnlyOneValueForKey([{ a: 1 }, { a: 2 }], "a")).toBe(false);
  });
});

describe("getSunCurveYAxisConfig", () => {
  it("calculates minimum domain of [0, 20] with 5-unit ticks for 16 kWp plant with zero generation", () => {
    const config = getSunCurveYAxisConfig(16, 0);
    expect(config.domain).toEqual([0, 20]);
    expect(config.ticks).toEqual([0, 5, 10, 15, 20]);
  });

  it("preserves 20 kW domain for peaks within nominal capacity", () => {
    const config = getSunCurveYAxisConfig(16, 16.8);
    expect(config.domain).toEqual([0, 20]);
    expect(config.ticks).toEqual([0, 5, 10, 15, 20]);
  });

  it("expands domain in multiples of 5 when power exceeds 20 kW", () => {
    const config = getSunCurveYAxisConfig(16, 21.5);
    expect(config.domain).toEqual([0, 25]);
    expect(config.ticks).toEqual([0, 5, 10, 15, 20, 25]);
  });
});

describe("getInverterCurveYAxisConfig", () => {
  it("calculates default domain of [0, 8] with 2-unit ticks for standard inverters (up to 6 kW)", () => {
    const config = getInverterCurveYAxisConfig(0);
    expect(config.domain).toEqual([0, 8]);
    expect(config.ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it("preserves 8 kW domain for inverters at peak generation (5.8 kW)", () => {
    const config = getInverterCurveYAxisConfig(5.8);
    expect(config.domain).toEqual([0, 8]);
    expect(config.ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it("expands in multiples of 2 if an inverter exceeds 8 kW", () => {
    const config = getInverterCurveYAxisConfig(8.5);
    expect(config.domain).toEqual([0, 10]);
    expect(config.ticks).toEqual([0, 2, 4, 6, 8, 10]);
  });
});
