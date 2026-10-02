import { test, expect } from "@playwright/test";

test.describe("Modo Demonstração (Portfólio / Showcase)", () => {
  test("acesso a /demo define cookie solarhub_demo=1 e redireciona para a raiz", async ({
    page,
    context,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    const cookies = await context.cookies();
    const demoCookie = cookies.find((c) => c.name === "solarhub_demo");
    expect(demoCookie).toBeDefined();
    expect(demoCookie?.value).toBe("1");
  });

  test("exibe banner de modo demonstração, usina demo e usuário Visitante", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    // Banner de demonstração no topo
    await expect(
      page.getByText("Modo demonstração — dados fictícios"),
    ).toBeVisible();

    // Usina e identificação no menu
    await expect(page.getByText("Usina Solar").first()).toBeVisible();
    await expect(page.getByText("Visitante (Demo)")).toBeVisible();

    // Gráficos carregados com sucesso
    const svgCharts = page.locator(".recharts-responsive-container svg");
    await expect(svgCharts.first()).toBeVisible({ timeout: 10000 });
  });

  test("navega por todas as abas do dashboard no modo demo", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    // Página Placas & Inversores
    await page.goto("/placas");
    await expect(page).toHaveURL("/placas");
    await expect(
      page.getByRole("heading", { name: "Placas & Inversores" }),
    ).toBeVisible();
    await expect(
      page.getByText("Painel de Engenharia & Qualidade de Energia"),
    ).toBeVisible();

    // Página Cooperativa
    await page.goto("/cooperativa");
    await expect(page).toHaveURL("/cooperativa");
    await expect(page.getByText("Cooperativa").first()).toBeVisible();

    // Página Visão Combinada
    await page.goto("/combinada");
    await expect(page).toHaveURL("/combinada");
    await expect(page.getByRole("heading", { name: "Análise" })).toBeVisible();
  });

  test("página /login não exibe link ou botão para demonstração", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    const demoButtonsOrLinks = page.locator("a[href*='demo'], button:has-text('demo')");
    await expect(demoButtonsOrLinks).toHaveCount(0);
  });

  test("GET /api/ai-advisor com cookie demo retorna 200, isDemo: true e não aciona Gemini", async ({
    page,
  }) => {
    await page.goto("/demo");

    const response = await page.request.get("/api/ai-advisor");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.isDemo).toBe(true);
    expect(data.isCached).toBe(true);
    expect(data).toHaveProperty("daily");
    expect(data.daily).toHaveProperty("summary");
  });

  test("sair da demonstração limpa o cookie e redireciona para /login", async ({
    page,
    context,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    // Clica no link de sair da demonstração no banner
    const exitLink = page.getByRole("link", { name: "Sair da demonstração" });
    await expect(exitLink).toBeVisible();
    await exitLink.click();

    // Deve redirecionar para /login
    await expect(page).toHaveURL(/\/login/);

    // O cookie deve ter sido limpo
    const cookies = await context.cookies();
    const demoCookie = cookies.find((c) => c.name === "solarhub_demo");
    expect(demoCookie?.value ?? "").not.toBe("1");

    // Acessar raiz agora deve redirecionar para /login
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
