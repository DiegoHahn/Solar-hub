import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { Database } from "@/lib/database.types";

let cachedAuthenticatedClient: SupabaseClient<Database> | null = null;

export function getAnonClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false } });
}

export function getAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function getAuthenticatedTestClient(): Promise<SupabaseClient<Database>> {
  if (cachedAuthenticatedClient) return cachedAuthenticatedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = process.env.SUPABASE_TEST_EMAIL!;
  const password = process.env.SUPABASE_TEST_PASSWORD!;

  const client = createSupabaseClient<Database>(url, key, { auth: { persistSession: false } });
  if (email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Failed to sign in the test client for the integration tests:", error.message);
    }
  }
  cachedAuthenticatedClient = client;
  return client;
}

// Routes the Next.js cookie plumbing to the real authenticated Supabase client
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => {
      return await getAuthenticatedTestClient();
    },
  };
});
