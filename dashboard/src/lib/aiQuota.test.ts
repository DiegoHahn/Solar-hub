import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getBrasiliaDate,
  isPrimaryModel,
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  type AdvisorResult,
} from "./aiQuota";

const mockFrom = vi.fn();

const sampleAnalysis = (tag: string): AdvisorResult => ({
  daily: { summary: `${tag} daily`, recommendations: [] },
  monthly: { summary: `${tag} monthly`, recommendations: [] },
});
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

    await expect(getAdvisorCache("pt-BR")).resolves.toBeNull();
  });

  it("does not interrupt analysis generation when cache saving fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: new Error("Database failure") }),
    });

    await expect(saveAdvisorCache(sampleAnalysis("pt"), "gemini-3.8-flash", "pt-BR")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("advisor cache per locale", () => {
  const cachedRow = (analysis: unknown) => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { analysis }, error: null }),
      upsert,
    });
    return upsert;
  };

  it("returns only the analysis cached for the requested locale", async () => {
    const entry = { data: sampleAnalysis("en"), modelUsed: "gemini-3.8-flash", updatedAt: "2026-10-06T12:00:00Z" };
    cachedRow({ en: entry });

    await expect(getAdvisorCache("en")).resolves.toEqual(entry);
    await expect(getAdvisorCache("pt-BR")).resolves.toBeNull();
  });

  it("ignores analyses stored without a locale", async () => {
    cachedRow(sampleAnalysis("legacy"));

    await expect(getAdvisorCache("pt-BR")).resolves.toBeNull();
    await expect(getAdvisorCache("en")).resolves.toBeNull();
  });

  it("keeps the other locale when saving", async () => {
    const existing = { data: sampleAnalysis("en"), modelUsed: "gemini-3.8-flash", updatedAt: "2026-10-06T12:00:00Z" };
    const upsert = cachedRow({ en: existing });

    await saveAdvisorCache(sampleAnalysis("pt"), "gemini-3.7-flash", "pt-BR");

    const saved = upsert.mock.calls[0][0].analysis;
    expect(saved.en).toEqual(existing);
    expect(saved["pt-BR"].data.daily.summary).toBe("pt daily");
    expect(saved["pt-BR"].modelUsed).toBe("gemini-3.7-flash");
  });
});
