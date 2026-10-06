import { createClient } from "@supabase/supabase-js";
import { evaluateTelemetryHealth } from "../src/lib/monitoring";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    console.warn(
      "Supabase environment variables not configured in environment.\n" +
        "   (Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD).\n" +
        "   Skipping telemetry check without failing job.",
    );
    process.exit(0);
  }

  console.log("Connecting to Supabase to check telemetry freshness...");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error("Failed to sign in to Supabase:", authError.message);
    process.exit(1);
  }

  const [{ data: solarData, error: solarError }, { data: utilityData, error: utilityError }] =
    await Promise.all([
      supabase
        .from("solar_telemetry")
        .select("recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("utility_data")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (solarError) {
    console.error("Failed to query solar_telemetry:", solarError.message);
    process.exit(1);
  }

  if (utilityError) {
    console.error("Failed to query utility_data:", utilityError.message);
    process.exit(1);
  }

  const report = evaluateTelemetryHealth({
    solarTelemetry: solarData,
    utilityData: utilityData,
    now: new Date(),
  });

  console.log("\n=========================================");
  console.log("TELEMETRY MONITORING REPORT");
  console.log("=========================================");
  console.log(
    `Brasília Time: ${report.brasiliaTime} (Daytime: ${report.isDaytime ? "Yes" : "No"})`,
  );
  console.log(
    `Solar Telemetry:  [${report.solar.status.toUpperCase()}] ${report.solar.message}`,
  );
  if (report.solar.timestamp) {
    console.log(`    Latest record: ${report.solar.timestamp}`);
  }
  console.log(
    `Utility Provider: [${report.utility.status.toUpperCase()}] ${report.utility.message}`,
  );
  if (report.utility.timestamp) {
    console.log(`    Last update: ${report.utility.timestamp}`);
  }
  console.log("=========================================");

  if (!report.ok) {
    console.error("\nALERT: Telemetry issues detected:");
    for (const err of report.errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  console.log("All collectors are healthy and within their freshness limits.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error while running the telemetry check:", err);
  process.exit(1);
});
