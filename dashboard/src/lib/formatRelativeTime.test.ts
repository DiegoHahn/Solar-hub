import { describe, expect, it } from "vitest";
import { formatRelativeTime, minutesSince } from "./formatRelativeTime";

const NOW = new Date("2026-09-25T15:00:00-03:00").getTime();
const minutesAgo = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe("minutesSince", () => {
  it("rounds difference to whole minutes", () => {
    expect(minutesSince(minutesAgo(12.4), NOW)).toBe(12);
    expect(minutesSince(minutesAgo(12.6), NOW)).toBe(13);
  });

  it("returns negative value for future dates", () => {
    expect(minutesSince(minutesAgo(-5), NOW)).toBe(-5);
  });
});

describe("formatRelativeTime", () => {
  it.each([
    [0, "agora mesmo"],
    [0.4, "agora mesmo"],
    [1, "há 1 min"],
    [59, "há 59 min"],
    [60, "há 1h"],
    [23 * 60, "há 23h"],
    [24 * 60, "há 1 dia"],
    [3 * 24 * 60, "há 3 dias"],
  ])("%d minutes ago -> %s", (min, expected) => {
    expect(formatRelativeTime(minutesAgo(min), NOW)).toBe(expected);
  });
});
