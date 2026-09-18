import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BUSINESS_COOKIE, SESSION_COOKIE, cookieOptions } from "@/server/auth/session";
import { loginWithCredentials } from "@/server/application/authentication";
import { toErrorResponse } from "@/server/http/errorResponse";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const result = await loginWithCredentials({ email: record.email, password: record.password });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, result.sessionToken, cookieOptions(result.maxAgeSeconds));
    cookieStore.delete(BUSINESS_COOKIE);

    return NextResponse.json({ ok: true, email: result.auth.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
