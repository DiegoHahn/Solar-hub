import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const allowedEmailsRaw = process.env.ALLOWED_EMAILS || "";
      const allowedEmails = allowedEmailsRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const userEmail = (data.user.email || "").trim().toLowerCase();

      // Se houver uma lista configurada no ambiente e o e-mail não estiver nela:
      if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
        console.warn(`[Auth] Acesso negado para o e-mail: ${userEmail}. Não está na lista permitida.`);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized_email`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
