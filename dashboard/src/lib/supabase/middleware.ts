import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, maskEmail } from "@/lib/auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isDemoRoute = request.nextUrl.pathname.startsWith("/demo");
  const isAiAdvisorRoute = request.nextUrl.pathname === "/api/ai-advisor";
  const isDemo = request.cookies.get("solarhub_demo")?.value === "1";

  if (isDemoRoute) {
    return supabaseResponse;
  }

  if (!user) {
    if (isDemo) {
      if (isApiRoute && !isAiAdvisorRoute) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
      }
      return supabaseResponse;
    }

    if (isApiRoute) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!isLoginPage && !isAuthCallback) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Authenticated user, but email is not on allowlist
  if (!isAuthCallback && !isEmailAllowed(user.email)) {
    console.warn(
      `[Auth] Access denied for email: ${maskEmail(user.email)}. Unauthorized.`
    );
    await supabase.auth.signOut();

    if (isApiRoute) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=unauthorized_email";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (isDemo) {
    supabaseResponse.cookies.set("solarhub_demo", "", {
      path: "/",
      maxAge: 0,
    });
  }

  // Only page navigations are redirected: the login form calls a server action (POST /login)
  // right after signing in, and a redirect response would make that action fail.
  if (isLoginPage && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectResponse = NextResponse.redirect(url);
    if (isDemo) {
      redirectResponse.cookies.set("solarhub_demo", "", {
        path: "/",
        maxAge: 0,
      });
    }
    return redirectResponse;
  }

  return supabaseResponse;
}
