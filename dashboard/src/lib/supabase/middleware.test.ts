import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSession } from "./middleware";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  isEmailAllowed: vi.fn((email?: string) => email === "autorizado@exemplo.com"),
  maskEmail: vi.fn((email?: string) => email || ""),
}));

describe("middleware updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
  });

  it("permite navegação em páginas no modo demonstração sem usuário", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/placas", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });

  it("permite acesso a /api/ai-advisor no modo demonstração", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/api/ai-advisor", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });

  it("bloqueia outras rotas de /api com 401 mesmo no modo demonstração", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/api/telemetria", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(401);
  });

  it("apaga o cookie solarhub_demo quando o usuário está autenticado e autorizado", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: "autorizado@exemplo.com" } },
    });

    const req = new NextRequest("http://localhost:3000/", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("solarhub_demo=");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });
});
