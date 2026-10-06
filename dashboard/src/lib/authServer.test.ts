import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireUser } from "./authServer";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

const originalAllowed = process.env.ALLOWED_EMAILS;

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOWED_EMAILS = "teste@solarhub.local";
  });

  afterEach(() => {
    process.env.ALLOWED_EMAILS = originalAllowed;
  });

  it("returns null when no user is logged in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const user = await requireUser();
    expect(user).toBeNull();
  });

  it("returns null when user email is not in allowlist", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "usr-1",
          email: "invasor@externo.local",
        },
      },
    });
    const user = await requireUser();
    expect(user).toBeNull();
  });

  it("returns user when email is in allowlist", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "usr-2",
          email: "teste@solarhub.local",
        },
      },
    });
    const user = await requireUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe("teste@solarhub.local");
  });
});
