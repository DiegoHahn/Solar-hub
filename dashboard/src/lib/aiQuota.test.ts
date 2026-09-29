import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getBrasiliaDate,
  isPrimaryModel,
  getQuotaState,
  incrementQuota,
  getAdvisorCache,
  saveAdvisorCache,
  fallbackAdvisorAnalysis,
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

describe("falhas de acesso ao banco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna zeros quando a consulta de cota falha ou não tem dados", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Falha no banco"),
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

  it("aplica fallback quando RPC falha ao incrementar cota", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("RPC indisponível"),
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

  it("trata o cache da análise como ausente quando a leitura falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("Falha no banco") }),
    });

    await expect(getAdvisorCache()).resolves.toBeNull();
  });

  it("não interrompe a geração da análise quando salvar o cache falha", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error("Falha no banco") }),
    });

    await expect(saveAdvisorCache(fallbackAdvisorAnalysis, "gemini-3.8-flash")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
