import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearDemoCookie } from "./actions";

const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockSet,
  })),
}));

describe("clearDemoCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apaga o cookie solarhub_demo definindo maxAge 0 e path /", async () => {
    await clearDemoCookie();
    expect(mockSet).toHaveBeenCalledWith("solarhub_demo", "", {
      path: "/",
      maxAge: 0,
    });
  });
});
