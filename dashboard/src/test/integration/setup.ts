import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";

let cachedAuthenticatedClient: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function getAuthenticatedTestClient(): Promise<SupabaseClient> {
  if (cachedAuthenticatedClient) return cachedAuthenticatedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = process.env.SUPABASE_TEST_EMAIL!;
  const password = process.env.SUPABASE_TEST_PASSWORD!;

  const client = createSupabaseClient(url, key, { auth: { persistSession: false } });
  if (email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Falha ao logar cliente de teste nos testes de integração:", error.message);
    }
  }
  cachedAuthenticatedClient = client;
  return client;
}

// Intercepta a fiação de cookies do Next.js e direciona para o cliente real autenticado do Supabase
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => {
      return await getAuthenticatedTestClient();
    },
  };
});
