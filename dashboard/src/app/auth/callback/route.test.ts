import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockExchangeCode = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  isEmailAllowed: vi.fn((email?: string) => email === "autorizado@exemplo.com"),
  maskEmail: vi.fn((email?: string) => email || ""),
  getSafeRedirectUrl: vi.fn((next?: string | null) => next && next.startsWith("/") ? next : "/"),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when code is not provided", async () => {
    const req = new Request("http://localhost:3000/auth/callback");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_failed");
  });

  it("redirects to safe destination and clears solarhub_demo cookie on successful login", async () => {
    mockExchangeCode.mockResolvedValueOnce({
      data: { user: { email: "autorizado@exemplo.com" } },
      error: null,
    });

    const req = new Request("http://localhost:3000/auth/callback?code=valid-code&next=/placas");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/placas");

    // Verify that solarhub_demo cookie is cleared (maxAge: 0)
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("solarhub_demo=");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it("signs out and redirects with error if email is not in allowlist", async () => {
    mockExchangeCode.mockResolvedValueOnce({
      data: { user: { email: "invasor@externo.local" } },
      error: null,
    });

    const req = new Request("http://localhost:3000/auth/callback?code=valid-code");
    const res = await GET(req);

    expect(mockSignOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=unauthorized_email");
  });

  it("redirects to login with error if exchangeCodeForSession fails", async () => {
    mockExchangeCode.mockResolvedValueOnce({
      data: null,
      error: new Error("Código inválido"),
    });

    const req = new Request("http://localhost:3000/auth/callback?code=invalid-code");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_failed");
  });
});
