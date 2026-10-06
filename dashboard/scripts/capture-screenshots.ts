import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";

const OUTPUT_DIR = path.resolve(__dirname, "../../docs/images");
const PORT = 3108;
const BASE_URL = `http://localhost:${PORT}`;

function isServerListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/login`, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startServer(): Promise<ChildProcess> {
  if (await isServerListening(PORT)) {
    // Um servidor já ativo não teria o DEMO_NOW desta captura e geraria telas no horário errado.
    throw new Error(`Port ${PORT} is already in use; stop that server before capturing.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const demoNow = process.env.DEMO_NOW || `${today}T13:30:00-03:00`;

  console.log(`[Screenshot] Starting Next.js on port ${PORT} with DEMO_NOW=${demoNow}...`);
  const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DEMO_NOW: demoNow },
    stdio: "ignore",
    detached: false,
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 30000) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isServerListening(PORT)) {
      console.log(`[Screenshot] Servidor pronto em ${BASE_URL}`);
      return proc;
    }
  }

  throw new Error("Timed out waiting for Next.js on port " + PORT);
}

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const serverProc = await startServer();
  const browser = await chromium.launch();

  try {
    // 1. Desktop - 1440x900, Tema Escuro
    console.log("[Screenshot] Capturing desktop pages (1440x900)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });

    const page = await desktopContext.newPage();

    // Ativa demonstração
    await page.goto(`${BASE_URL}/demo`);
    await page.waitForURL(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Aguarda animações do Recharts

    // 1.1 Início
    console.log("  -> inicio.png");
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "inicio.png"),
      fullPage: false,
    });

    // 1.2 Placas & Inversores
    console.log("  -> placas.png");
    await page.goto(`${BASE_URL}/placas`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "placas.png"),
      fullPage: false,
    });

    // 1.3 Cooperativa
    console.log("  -> cooperativa.png");
    await page.goto(`${BASE_URL}/cooperativa`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "cooperativa.png"),
      fullPage: false,
    });

    // 1.4 Análise Combinada
    console.log("  -> analise.png");
    await page.goto(`${BASE_URL}/combinada`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "analise.png"),
      fullPage: false,
    });

    await desktopContext.close();

    // 2. Mobile - 390x844 (iPhone 14 / Viewport padrão mobile), Tema Escuro
    console.log("[Screenshot] Capturando Mobile (390x844)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/demo`);
    await mobilePage.waitForURL(`${BASE_URL}/`);
    await mobilePage.waitForLoadState("networkidle");
    await mobilePage.waitForTimeout(1000);

    console.log("  -> mobile-inicio.png");
    await mobilePage.screenshot({
      path: path.join(OUTPUT_DIR, "mobile-inicio.png"),
      fullPage: false,
    });

    await mobileContext.close();
    console.log("[Screenshot] Todas as capturas foram salvas em docs/images/");
  } finally {
    await browser.close();
    serverProc.kill();
  }
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
