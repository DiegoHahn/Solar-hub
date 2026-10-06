import { describe, expect, it } from "vitest";
import { brasiliaClock, brasiliaIsoDaysAgo, minutesSince, toBrasiliaIsoDate } from "./dates";

describe("toBrasiliaIsoDate", () => {
  it("converts UTC date to correct day in Brasília timezone", () => {
    // 15:00 UTC = 12:00 BRT
    const date = new Date("2026-06-15T15:00:00Z");
    expect(toBrasiliaIsoDate(date)).toBe("2026-06-15");
  });

  it("preserves Brasília date late at night (23:30 BRT = 02:30 UTC next day)", () => {
    const lateNightBrt = new Date("2026-06-15T23:30:00-03:00");
    expect(toBrasiliaIsoDate(lateNightBrt)).toBe("2026-06-15");
  });

  it("recognizes new day immediately after midnight in Brasília (00:15 BRT = 03:15 UTC)", () => {
    const earlyMorningBrt = new Date("2026-06-16T00:15:00-03:00");
    expect(toBrasiliaIsoDate(earlyMorningBrt)).toBe("2026-06-16");
  });
});

describe("brasiliaClock", () => {
  it("formats hour and minutes in h23", () => {
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
  ])("at time %s sets isDaytime to %s", (_, date, expectedDaytime) => {
    const clock = brasiliaClock(date);
    expect(clock.isDaytime).toBe(expectedDaytime);
  });
});

describe("brasiliaIsoDaysAgo", () => {
  const base = new Date("2026-01-03T12:00:00-03:00");

  it("returns same date when days is 0", () => {
    expect(brasiliaIsoDaysAgo(0, base)).toBe("2026-01-03");
  });

  it("calculates retroactive days in the same month", () => {
    expect(brasiliaIsoDaysAgo(2, base)).toBe("2026-01-01");
  });

  it("calculates retroactive days across year turnover", () => {
    expect(brasiliaIsoDaysAgo(4, base)).toBe("2025-12-30");
  });
});

describe("minutesSince", () => {
  const NOW = new Date("2026-09-25T15:00:00-03:00").getTime();
  const minutesAgo = (min: number) => new Date(NOW - min * 60_000).toISOString();

  it("rounds the difference to whole minutes", () => {
    expect(minutesSince(minutesAgo(12.4), NOW)).toBe(12);
    expect(minutesSince(minutesAgo(12.6), NOW)).toBe(13);
  });

  it("returns a negative value for future dates", () => {
    expect(minutesSince(minutesAgo(-5), NOW)).toBe(-5);
  });
});
