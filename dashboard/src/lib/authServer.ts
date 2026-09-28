import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

/**
 * Obtém o usuário autenticado na requisição atual e valida se ele está na allowlist.
 * Retorna o usuário ou null se não autenticado/não autorizado.
 */
export async function requireUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) {
    return null;
  }

  return user;
}
