import { test, expect } from "@playwright/test";

test.describe("Acesso Não Autenticado e Segurança", () => {
  const protectedRoutes = ["/", "/placas", "/cooperativa", "/combinada"];

  for (const route of protectedRoutes) {
    test(`redireciona ${route} para /login quando não logado`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("h1")).toContainText("Solar Hub");
    });
  }

  test("retorna 401 em GET /api/ai-advisor sem autenticação", async ({ request }) => {
    const res = await request.get("/api/ai-advisor");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Não autenticado.");
  });

  test("retorna 401 em POST /api/ai-advisor sem autenticação", async ({ request }) => {
    const res = await request.post("/api/ai-advisor", {
      data: { force: false },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Não autenticado.");
  });

  test("aplica headers de segurança e CSP rigorosos", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    const headers = response!.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("bloqueia tentativas de open redirect no callback de auth", async ({ page, baseURL }) => {
    await page.goto("/auth/callback?code=invalido&next=@evil.com");
    expect(page.url().startsWith(baseURL!)).toBe(true);

    await page.goto("/auth/callback?code=invalido&next=//evil.com");
    expect(page.url().startsWith(baseURL!)).toBe(true);
  });

  test("exibe mensagem genérica ao tentar login com senha incorreta", async ({ page }) => {
    await page.goto("/login");

    const email = process.env.SUPABASE_TEST_EMAIL || "teste-invalido@solarhub.local";
    await page.fill("#email", email);
    await page.fill("#password", "senha-incorreta-999");
    await page.click("button[type='submit']");

    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});
