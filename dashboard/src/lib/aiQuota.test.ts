import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getBrasiliaDate,
  isPrimaryModel,
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  getFallbackAdvisorAnalysis,
} from "./aiQuota";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

describe("getBrasiliaDate", () => {
  it("converts UTC date to correct day in Brasília timezone", () => {
    const utcNoon = new Date("2026-07-20T15:00:00Z"); // 12:00 BRT
    expect(getBrasiliaDate(utcNoon)).toBe("2026-07-20");
  });

  it("preserves current date at 23:30 in Brasília (02:30 UTC next day)", () => {
    const lateNightBrt = new Date("2026-07-20T23:30:00-03:00");
    expect(getBrasiliaDate(lateNightBrt)).toBe("2026-07-20");
  });

  it("rolls over date immediately after midnight in Brasília (00:05 BRT = 03:05 UTC)", () => {
    const earlyMorningBrt = new Date("2026-07-21T00:05:00-03:00");
    expect(getBrasiliaDate(earlyMorningBrt)).toBe("2026-07-21");
  });
});

describe("isPrimaryModel", () => {
  const PRIMARY = "gemini-3.8-flash";

  it("recognizes identical model names", () => {
    expect(isPrimaryModel("gemini-3.8-flash", PRIMARY)).toBe(true);
  });

  it("ignores casing differences and surrounding whitespace", () => {
    expect(isPrimaryModel("  GEMINI-3.8-FLASH  ", PRIMARY)).toBe(true);
    expect(isPrimaryModel("Gemini-3.8-Flash", " gemini-3.8-flash ")).toBe(true);
  });

  it("accepts common version and namespace prefixes/suffixes", () => {
    expect(isPrimaryModel("models/gemini-3.8-flash", PRIMARY)).toBe(true);
    expect(isPrimaryModel("gemini-3.8-flash-latest", PRIMARY)).toBe(true);
    expect(isPrimaryModel("gemini-3.8-flash-001", PRIMARY)).toBe(true);
  });

  it("returns false for distinct models", () => {
    expect(isPrimaryModel("gemini-1.5-flash", PRIMARY)).toBe(false);
    expect(isPrimaryModel("gemini-3.8-pro", PRIMARY)).toBe(false);
    expect(isPrimaryModel("gpt-4o", PRIMARY)).toBe(false);
  });
});

describe("database access failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroes when quota query fails or has no data", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Database failure"),
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    const state = await getQuotaState();
    expect(state.primary_count).toBe(0);
    expect(state.total_calls).toBe(0);
  });

  it("applies fallback when RPC fails to increment quota", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("RPC unavailable"),
      }),
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { primary_count: 1, total_calls: 1 },
      error: null,
    });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    });

    const state = await incrementQuota("gemini-3.8-flash");
    expect(state.total_calls).toBe(2);
    expect(state.primary_count).toBe(2);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("treats advisor cache as absent when read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("Database failure") }),
    });

    await expect(getAdvisorCache()).resolves.toBeNull();
  });

  it("does not interrupt analysis generation when cache saving fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error("Database failure") }),
    });

    await expect(saveAdvisorCache(getFallbackAdvisorAnalysis("pt-BR"), "gemini-3.8-flash")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("getFallbackAdvisorAnalysis", () => {
  it("returns the analysis in the requested locale", () => {
    const ptBR = getFallbackAdvisorAnalysis("pt-BR");
    const en = getFallbackAdvisorAnalysis("en");

    expect(en.daily.recommendations).toHaveLength(ptBR.daily.recommendations.length);
    expect(en.monthly.recommendations).toHaveLength(ptBR.monthly.recommendations.length);
    expect(en.daily.summary).not.toBe(ptBR.daily.summary);
    expect(en.daily.recommendations.map((r) => r.icon)).toEqual(ptBR.daily.recommendations.map((r) => r.icon));
  });
});
