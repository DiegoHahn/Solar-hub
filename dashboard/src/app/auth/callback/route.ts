import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed, maskEmail, getSafeRedirectUrl } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const userEmail = data.user.email;

      if (!isEmailAllowed(userEmail)) {
        console.warn(`[Auth] Access denied for email: ${maskEmail(userEmail)}. Unauthorized.`);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized_email`);
      }

      const safeNext = getSafeRedirectUrl(next);
      const response = NextResponse.redirect(`${origin}${safeNext}`);
      response.cookies.set("solarhub_demo", "", {
        path: "/",
        maxAge: 0,
      });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
