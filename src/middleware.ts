import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";
import { verifySupabaseAccessToken } from "@/server/auth/supabaseAuth";

const PUBLIC_PATHS = ["/login", "/api/health", "/api/auth/login"];

/**
 * Edge gate for every non-public route. The session token is cryptographically
 * verified here (not merely checked for presence); protected API routes get a
 * 401 JSON response, pages redirect to /login. Handlers and server actions
 * still authenticate and authorize independently — this is not the only layer.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  const credential = bearer ?? token;

  let authenticated = false;
  if (credential) {
    try {
      await verifySupabaseAccessToken(credential);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    if (token) redirect.cookies.delete(SESSION_COOKIE);
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
