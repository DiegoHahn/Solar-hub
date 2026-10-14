import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { getAdminClient } from "./setup";

// Creates a throwaway Auth user that is NOT in public.allowed_users, signs in with it and checks that
// RLS returns no rows and rejects writes. Needs the service_role key to create and delete that user.
const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SENTINEL_DATE = "1999-01-02";

describe.skipIf(!hasEnv)("Supabase Integration — email allowlist enforced by RLS", () => {
  let migrationApplied = false;
  let userId: string | null = null;
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    const admin = getAdminClient();

    // Skip (instead of failing) until the allowlist migration has been applied to the project.
    const probe = await admin.from("allowed_users").select("email", { head: true, count: "exact" });
    migrationApplied = !probe.error;
    if (!migrationApplied) {
      console.warn("public.allowed_users not found; skipping the allowlist RLS tests:", probe.error?.message);
      return;
    }

    const email = `rls-not-allowed-${randomUUID()}@example.invalid`;
    const password = `${randomUUID()}Aa1!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      { auth: { persistSession: false } },
    );
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    const admin = getAdminClient();
    await Promise.all([
      admin.from("ai_advisor_daily").delete().eq("date", SENTINEL_DATE),
      admin.from("daily_weather").delete().eq("date", SENTINEL_DATE),
    ]);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("returns zero rows from every dashboard table and view", async (ctx) => {
    if (!migrationApplied) ctx.skip();

    const results = await Promise.all([
      client.from("solar_telemetry").select("id").limit(1),
      client.from("utility_data").select("id").limit(1),
      client.from("daily_generation").select("date").limit(1),
      client.from("inverter_daily_history").select("id").limit(1),
      client.from("inverter_monthly_history").select("id").limit(1),
      client.from("ai_advisor_daily").select("date").limit(1),
      client.from("daily_weather").select("date").limit(1),
      client.from("allowed_users").select("email").limit(1),
    ]);

    for (const result of results) {
      expect(result.data?.length ?? 0).toBe(0);
    }
  });

  it("rejects writes to the cache and quota tables", async (ctx) => {
    if (!migrationApplied) ctx.skip();

    const [weather, advisor, rpc] = await Promise.all([
      client.from("daily_weather").insert({
        date: SENTINEL_DATE,
        weather_code: 1,
        temperature_max_c: 1,
        temperature_min_c: 1,
        sunshine_duration_s: 1,
        shortwave_radiation_mj: 1,
        precipitation_mm: 1,
        source: "forecast",
      }),
      client.from("ai_advisor_daily").insert({ date: SENTINEL_DATE }),
      client.rpc("increment_ai_quota", { p_date: SENTINEL_DATE, p_is_primary: true }),
    ]);

    expect(weather.error?.code).toBe("42501");
    expect(advisor.error?.code).toBe("42501");
    expect(rpc.error?.code).toBe("42501");
  });

  it("reports the user as not allowed", async (ctx) => {
    if (!migrationApplied) ctx.skip();

    const { data, error } = await client.rpc("is_allowed_user");
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});
