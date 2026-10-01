import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;

async function getTodayCachedAnalysis(): Promise<{ daily: { summary: string } } | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  await supabase.auth.signInWithPassword({ email: testEmail!, password: testPassword! });
  const { data } = await supabase
    .from("ai_advisor_daily")
    .select("analysis")
    .eq("date", new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))
    .maybeSingle();
  return data?.analysis ?? null;
}

test.describe("Fluxos Autenticados com Dados Reais", () => {
  test.skip(!testEmail || !testPassword, "Credenciais de teste não configuradas no .env.test.local");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", testEmail!);
    await page.fill("#password", testPassword!);
    await page.click("button[type='submit']");

    await expect(page).toHaveURL("/", { timeout: 15000 });
  });

  test("carrega o dashboard principal com KPIs e gráficos reais", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();

    const svgCharts = page.locator(".recharts-responsive-container svg");
    await expect(svgCharts.first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/kW|kWh/i).first()).toBeVisible();
  });

  test("navega para a página Placas e exibe inversores reais", async ({ page }) => {
    await page.goto("/placas");
    await expect(page).toHaveURL("/placas");

    await expect(page.getByRole("heading", { name: "Placas & Inversores" })).toBeVisible();
    await expect(page.getByText("Painel de Engenharia & Qualidade de Energia")).toBeVisible();
    await expect(page.locator("p", { hasText: /Inversor 1/i })).toBeVisible({ timeout: 10000 });
  });

  test("navega para a página Cooperativa e exibe balanço e extrato", async ({ page }) => {
    await page.goto("/cooperativa");
    await expect(page).toHaveURL("/cooperativa");

    await expect(page.getByText("Cooperativa").first()).toBeVisible();
    await expect(page.getByText(/Saldo de créditos|Extrato/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("redireciona usuário autenticado que tenta acessar /login de volta para /", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("consulta GET /api/ai-advisor autenticado e recebe a análise em cache do dia", async ({ page }) => {
    const cached = await getTodayCachedAnalysis();
    // Sem cache a rota chamaria o Gemini; o teste não consome cota nem grava análise fictícia na produção.
    test.skip(!cached, "Ainda não há análise em cache para hoje.");

    const response = await page.request.get("/api/ai-advisor");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.isCached).toBe(true);
    expect(body.daily.summary).toBe(cached!.daily.summary);
  });
});
