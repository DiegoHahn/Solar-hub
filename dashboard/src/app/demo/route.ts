import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";

  const isSecure =
    process.env.NODE_ENV === "production" &&
    (request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https");

  const response = NextResponse.redirect(url);
  response.cookies.set("solarhub_demo", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 8 * 60 * 60, // 8 horas
  });

  return response;
}
