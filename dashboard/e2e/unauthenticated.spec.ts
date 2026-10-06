import { test, expect } from "@playwright/test";

test.describe("Unauthenticated access and security", () => {
  const protectedRoutes = ["/", "/placas", "/cooperativa", "/combinada"];

  for (const route of protectedRoutes) {
    test(`redirects ${route} to /login when signed out`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("h1")).toContainText("Solar Hub");
    });
  }

  test("returns 401 on GET /api/ai-advisor without authentication", async ({ request }) => {
    const res = await request.get("/api/ai-advisor");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Not authenticated.");
  });

  test("returns 401 on POST /api/ai-advisor without authentication", async ({ request }) => {
    const res = await request.post("/api/ai-advisor", {
      data: { force: false },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Not authenticated.");
  });

  test("applies strict security headers and CSP", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    const headers = response!.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("blocks open redirect attempts in the auth callback", async ({ page, baseURL }) => {
    await page.goto("/auth/callback?code=invalid&next=@evil.com");
    expect(page.url().startsWith(baseURL!)).toBe(true);

    await page.goto("/auth/callback?code=invalid&next=//evil.com");
    expect(page.url().startsWith(baseURL!)).toBe(true);
  });

  test("shows a generic message for a wrong password", async ({ page }) => {
    await page.goto("/login");

    const email = process.env.SUPABASE_TEST_EMAIL || "teste-invalido@solarhub.local";
    await page.fill("#email", email);
    await page.fill("#password", "senha-incorreta-999");
    await page.click("button[type='submit']");

    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});
