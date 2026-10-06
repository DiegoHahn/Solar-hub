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

  it("allows page navigation in demo mode without authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/placas", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });

  it("allows access to /api/ai-advisor in demo mode", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/api/ai-advisor", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });

  it("blocks other /api routes with 401 even in demo mode", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new NextRequest("http://localhost:3000/api/telemetria", {
      headers: { cookie: "solarhub_demo=1" },
    });
    const res = await updateSession(req);

    expect(res.status).toBe(401);
  });

  it("deletes solarhub_demo cookie when user is authenticated and authorized", async () => {
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
