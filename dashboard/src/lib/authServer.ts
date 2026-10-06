import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

/**
 * Retrieves the authenticated user from the current request and validates allowlist membership.
 * Returns the user object or null if unauthenticated/unauthorized.
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
