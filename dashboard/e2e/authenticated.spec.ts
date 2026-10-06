import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ptBR } from "../src/i18n/locales/pt-BR";

const testEmail = process.env.SUPABASE_TEST_EMAIL;
const testPassword = process.env.SUPABASE_TEST_PASSWORD;

/** Today's pt-BR analysis, the locale the browser context uses by default. */
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
  const analysis = data?.analysis as { "pt-BR"?: { data: { daily: { summary: string } } } } | null;
  return analysis?.["pt-BR"]?.data ?? null;
}

test.describe("Authenticated flows with real data", () => {
  test.skip(!testEmail || !testPassword, "Test credentials are not set in .env.test.local");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", testEmail!);
    await page.fill("#password", testPassword!);
    await page.click("button[type='submit']");

    await expect(page).toHaveURL("/", { timeout: 15000 });
  });

  test("loads the main dashboard with real KPIs and charts", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();

    const svgCharts = page.locator(".recharts-responsive-container svg");
    await expect(svgCharts.first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/kW|kWh/i).first()).toBeVisible();
  });

  test("navigates to the Panels page and shows real inverters", async ({ page }) => {
    await page.goto("/placas");
    await expect(page).toHaveURL("/placas");

    await expect(page.getByRole("heading", { name: ptBR.inverters.title })).toBeVisible();
    await expect(page.getByText(ptBR.inverters.engineeringTitle)).toBeVisible();
    await expect(page.locator("p", { hasText: /Inversor 1/i })).toBeVisible({ timeout: 10000 });
  });

  test("navigates to the Cooperative page and shows the balance and statement", async ({ page }) => {
    await page.goto("/cooperativa");
    await expect(page).toHaveURL("/cooperativa");

    await expect(page.getByText("Cooperativa").first()).toBeVisible();
    await expect(page.getByText(/Saldo de créditos|Extrato/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("redirects a signed-in user from /login back to /", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("GET /api/ai-advisor while signed in returns today's cached analysis", async ({ page }) => {
    const cached = await getTodayCachedAnalysis();
    // Without a cached analysis the route would call Gemini; the test must not spend quota or store a fake analysis in production.
    test.skip(!cached, "No analysis cached for today yet.");

    const response = await page.request.get("/api/ai-advisor");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.isCached).toBe(true);
    expect(body.daily.summary).toBe(cached!.daily.summary);
  });
});
