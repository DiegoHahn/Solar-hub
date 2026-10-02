import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const FIXTURES_DIR = path.resolve(__dirname, "../src/test/fixtures");

function ensureFixturesDir() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
}

/** Campos identificáveis e o valor fictício que substitui cada ocorrência distinta. */
const SENSITIVE_FIELDS: Array<[RegExp, (index: number) => string]> = [
  [/^(cpf|cpfcnpj|inscricao|documento)$/i, () => "000.000.000-00"],
  [/(^|_)(datanascimento|nascimento)$/i, () => "01/01/1970 00:00:00"],
  [/(telefone|celular|fone)$/i, () => "(00) 00000-0000"],
  [/^(titular|nometitular|nomeusuario)$/i, () => "Titular Teste"],
  [/^(endereco|logradouro)$/i, (i) => `Rua Teste, ${(i + 1) * 100}`],
  [/^email$/i, (i) => `teste${i + 1}@solarhub.local`],
  [/ssid$/i, (i) => `WIFI-TESTE-${i + 1}`],
  [/mac$/i, (i) => `02:00:00:00:00:${String(i + 1).padStart(2, "0")}`],
  [/(^|_)(sn|serial)$/i, (i) => `SN-${i + 1}`],
  [/^(codigouc|codigoucant|codigoconsumidor|codigofatura|codigo_uc)$/i, (i) => String(90001 + i)],
  [/(^|_)ip$/i, (i) => `10.0.0.${i + 1}`],
];

/** Valores curtos (flags, zeros, "N/A") não identificam ninguém e colidiriam com dados numéricos. */
const MIN_SENSITIVE_LENGTH = 4;

function collectSensitiveValues(node: unknown, found: Map<string, string>, counters: number[]) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectSensitiveValues(item, found, counters));
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") {
      collectSensitiveValues(value, found, counters);
      continue;
    }
    const text = String(value ?? "").trim();
    if (text.length < MIN_SENSITIVE_LENGTH || found.has(text)) continue;

    const ruleIndex = SENSITIVE_FIELDS.findIndex(([pattern]) => pattern.test(key));
    if (ruleIndex >= 0) {
      const placeholder = SENSITIVE_FIELDS[ruleIndex][1](counters[ruleIndex]++);
      const unaccented = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const digits = text.replace(/\D/g, "");
      const variants = [text, text.toUpperCase(), unaccented, unaccented.toUpperCase()];
      if (digits.length >= 11) variants.push(digits);
      for (const variant of variants) {
        if (!found.has(variant)) found.set(variant, placeholder);
      }
    }
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Substitui, em todo o JSON, cada valor coletado dos campos identificáveis, inclusive quando ele se
 * repete em outros campos ou como chave de objeto. Os valores são coletados de `source` (o dado bruto,
 * antes de qualquer substituição manual); CPFs e IPs privados são mascarados em qualquer lugar.
 */
function anonymize(data: unknown, source: unknown): string {
  const found = new Map<string, string>();
  collectSensitiveValues(source, found, SENSITIVE_FIELDS.map(() => 0));

  let json = JSON.stringify(data, null, 2);
  const longestFirst = [...found.entries()].sort(([a], [b]) => b.length - a.length);
  for (const [original, placeholder] of longestFirst) {
    json = json.replace(new RegExp(`(?<![\\w.-])${escapeRegExp(original)}(?![\\w-])`, "g"), placeholder);
  }
  return json
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "000.000.000-00")
    .replace(/(?<![\d.])\d{11}(?![\d.])/g, "00000000000")
    .replace(/\b192\.168\.\d+\.\d+\b/g, "10.0.0.1");
}

function saveJson(filename: string, data: unknown, source: unknown = data) {
  const filePath = path.join(FIXTURES_DIR, filename);
  const cleanStr = anonymize(data, source);
  fs.writeFileSync(filePath, cleanStr + "\n", "utf-8");
  console.log(`Salvo e anonimizado: ${filename}`);
}

async function captureOpenMeteo() {
  console.log("\n--- Capturando dados da Open-Meteo ---");
  const query = "latitude=-28.7139&longitude=-49.3003&daily=weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration,shortwave_radiation_sum,precipitation_sum&tilt=15&azimuth=155&timezone=America%2FSao_Paulo";

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${query}&past_days=7&forecast_days=1`;
  const forecastRes = await fetch(forecastUrl);
  if (!forecastRes.ok) {
    throw new Error(`Falha ao buscar forecast da Open-Meteo: ${forecastRes.statusText}`);
  }
  const forecastJson = await forecastRes.json();
  saveJson("open-meteo-forecast.json", forecastJson);

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?${query}&start_date=2026-06-01&end_date=2026-06-15`;
  const archiveRes = await fetch(archiveUrl);
  if (!archiveRes.ok) {
    throw new Error(`Falha ao buscar archive da Open-Meteo: ${archiveRes.statusText}`);
  }
  const archiveJson = await archiveRes.json();
  saveJson("open-meteo-archive.json", archiveJson);
}

function loadEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [k, ...v] = trimmed.split("=");
      env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

async function captureSupabase() {
  console.log("\n--- Capturando dados do Supabase de Produção ---");
  const localEnv = loadEnvFile(path.resolve(__dirname, "../.env.test.local"));
  const defaultEnv = loadEnvFile(path.resolve(__dirname, "../.env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || defaultEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.SUPABASE_TEST_EMAIL || localEnv.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD || localEnv.SUPABASE_TEST_PASSWORD;

  if (!supabaseUrl || !anonKey) {
    console.warn("URL ou Chave do Supabase ausentes. Pulando captura do Supabase.");
    return;
  }

  if (!email || !password) {
    console.warn("SUPABASE_TEST_EMAIL ou SUPABASE_TEST_PASSWORD ausentes em .env.test.local. Pulando captura do Supabase.");
    return;
  }

  const supabase = createClient(supabaseUrl, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Erro de login no Supabase com usuário de teste:", authError.message);
    return;
  }
  console.log("Login com usuário de testes bem-sucedido.");

  console.log("Buscando solar_telemetry...");
  const { data: telemetryRows, error: telError } = await supabase
    .from("solar_telemetry")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(200);

  if (telError) {
    console.error("Erro ao buscar solar_telemetry:", telError.message);
  } else if (telemetryRows && telemetryRows.length > 0) {
    const targetDate = telemetryRows[0].recorded_at.slice(0, 10);
    const dayRows = telemetryRows.filter((r) => r.recorded_at.startsWith(targetDate));

    const anonymizedTelemetry = dayRows.map((row) => ({
      ...row,
      plant_name: "Usina Teste (16 kW)",
      inverters_data: ((row.inverters_data as Array<Record<string, unknown>>) || []).map((inv, idx: number) => ({
        ...inv,
        ip: `10.0.0.${(idx + 1) * 10}`,
        serial: `SN-${idx + 1}`,
        inverter_sn: `SN-${idx + 1}`,
        logger_sn: `SN-LOGGER-${idx + 1}`,
      })),
    }));
    saveJson("telemetry-day.json", anonymizedTelemetry, dayRows);
  }

  console.log("Buscando daily_generation e inverter_daily_history...");
  const [dailyGenRes, dailyHistRes] = await Promise.all([
    supabase.from("daily_generation").select("*").order("date", { ascending: false }).limit(120),
    supabase.from("inverter_daily_history").select("*").order("date", { ascending: false }).limit(360),
  ]);

  if (dailyGenRes.error) console.error("Erro daily_generation:", dailyGenRes.error.message);
  if (dailyHistRes.error) console.error("Erro inverter_daily_history:", dailyHistRes.error.message);

  saveJson("daily-generation.json", {
    view: dailyGenRes.data || [],
    history: dailyHistRes.data || [],
  });

  console.log("Buscando inverter_monthly_history...");
  const { data: monthlyRows, error: monthError } = await supabase
    .from("inverter_monthly_history")
    .select("*")
    .order("month", { ascending: false });

  if (monthError) console.error("Erro inverter_monthly_history:", monthError.message);
  else saveJson("monthly-history.json", monthlyRows || []);

  console.log("Buscando utility_data...");
  const { data: utilityRows, error: utilError } = await supabase
    .from("utility_data")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (utilError) {
    console.error("Erro utility_data:", utilError.message);
  } else if (utilityRows && utilityRows.length > 0) {
    const raw = utilityRows[0];
    const ucs = raw.unidades_consumidoras || {};
    const ucKeys = Object.keys(ucs);

    const ucMap: Record<string, string> = {};
    ucKeys.forEach((k, idx) => {
      if (k === raw.generator_uc || ucs[k]?.geracao_distribuida?.PotenciaInstalada > 0) {
        ucMap[k] = "UC-GERADORA";
      } else {
        ucMap[k] = `UC-${idx + 1}`;
      }
    });

    const anonymizedUcs: Record<string, Record<string, unknown>> = {};
    for (const [oldKey, uc] of Object.entries(ucs) as [string, Record<string, unknown>][]) {
      const newKey = ucMap[oldKey] || `UC-${oldKey}`;
      anonymizedUcs[newKey] = {
        ...uc,
        codigo_uc: newKey,
        NomeTitular: "Titular Teste",
        CpfCnpj: "000.000.000-00",
        Endereco: "Rua Teste, 100",
        Bairro: "Centro",
        Municipio: "Içara",
      };
    }

    const anonymizedUtility = {
      ...raw,
      cpf: "000.000.000-00",
      titular: "Titular Teste",
      generator_uc: raw.generator_uc ? (ucMap[raw.generator_uc] || "UC-GERADORA") : null,
      unidades_consumidoras: anonymizedUcs,
    };
    saveJson("utility-data.json", anonymizedUtility, raw);
  }

  console.log("Buscando daily_weather...");
  const { data: weatherRows, error: wError } = await supabase
    .from("daily_weather")
    .select("*")
    .order("date", { ascending: false })
    .limit(90);

  if (wError) console.error("Erro daily_weather:", wError.message);
  else saveJson("daily-weather.json", weatherRows || []);
}

async function main() {
  ensureFixturesDir();
  await captureOpenMeteo();
  await captureSupabase();
  console.log("\nProcesso de captura de fixtures concluído!");
}

main().catch((err) => {
  console.error("Erro fatal na captura:", err);
  process.exit(1);
});
