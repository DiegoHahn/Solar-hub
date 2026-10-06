import { test, expect } from "@playwright/test";
import { ptBR } from "../src/i18n/locales/pt-BR";

test.describe("Demo mode", () => {
  test("visiting /demo sets the solarhub_demo=1 cookie and redirects to the root", async ({
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

  test("shows the demo banner, the demo plant and the Visitor user", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    await expect(
      page.getByText("Modo demonstração — dados fictícios"),
    ).toBeVisible();

    await expect(page.getByText("Usina Solar").first()).toBeVisible();
    await expect(page.getByText(ptBR.nav.guestDemo, { exact: true }).first()).toBeVisible();

    const svgCharts = page.locator(".recharts-responsive-container svg");
    await expect(svgCharts.first()).toBeVisible({ timeout: 10000 });
  });

  test("navigates through every dashboard tab in demo mode", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    await page.goto("/placas");
    await expect(page).toHaveURL("/placas");
    await expect(
      page.getByRole("heading", { name: ptBR.inverters.title }),
    ).toBeVisible();
    await expect(
      page.getByText(ptBR.inverters.engineeringTitle),
    ).toBeVisible();

    await page.goto("/cooperativa");
    await expect(page).toHaveURL("/cooperativa");
    await expect(page.getByText("Cooperativa").first()).toBeVisible();

    await page.goto("/combinada");
    await expect(page).toHaveURL("/combinada");
    await expect(page.getByRole("heading", { name: "Análise" })).toBeVisible();
  });

  test("the /login page has no demo link or button", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    const demoButtonsOrLinks = page.locator("a[href*='demo'], button:has-text('demo')");
    await expect(demoButtonsOrLinks).toHaveCount(0);
  });

  test("GET /api/ai-advisor with the demo cookie returns 200 and isDemo: true without calling Gemini", async ({
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

  test("leaving the demo clears the cookie and redirects to /login", async ({
    page,
    context,
  }) => {
    await page.goto("/demo");
    await expect(page).toHaveURL("/");

    const exitLink = page.getByRole("link", { name: "Sair da demonstração" });
    await expect(exitLink).toBeVisible();
    await exitLink.click();

    await expect(page).toHaveURL(/\/login/);

    const cookies = await context.cookies();
    const demoCookie = cookies.find((c) => c.name === "solarhub_demo");
    expect(demoCookie?.value ?? "").not.toBe("1");

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
