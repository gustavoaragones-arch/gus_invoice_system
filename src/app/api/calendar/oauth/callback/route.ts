import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/server/auth/session";
import { getAppBaseUrl } from "@/server/config/runtime";
import { assertGoogleCalendarConfigured } from "@/server/calendar/googleCalendarConfig";
import { exchangeGoogleAuthorizationCode, verifyGoogleOAuthState } from "@/server/calendar/googleOAuth";
import { connectCalendarFromOAuthForBusiness } from "@/server/application/calendar";
import { toErrorResponse } from "@/server/http/errorResponse";

function calendarRedirect(path = "/calendar", query?: Record<string, string>) {
  const url = new URL(path, getAppBaseUrl());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    assertGoogleCalendarConfigured();
    const auth = await getServerAuthContext();
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (error) {
      return calendarRedirect("/calendar", { calendarError: "Google Calendar authorization was not completed." });
    }
    if (!code || !state) {
      return calendarRedirect("/calendar", { calendarError: "Missing Google Calendar authorization response." });
    }

    const verifiedState = await verifyGoogleOAuthState(state);
    if (verifiedState.userId !== auth.userId) {
      return calendarRedirect("/calendar", { calendarError: "Google Calendar authorization context mismatch." });
    }

    const tokens = await exchangeGoogleAuthorizationCode(code);
    await connectCalendarFromOAuthForBusiness(auth, verifiedState.businessId, tokens);
    return calendarRedirect("/calendar", { calendarConnected: "1" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    const response = toErrorResponse(error);
    if (response.status >= 500) {
      return calendarRedirect("/calendar", { calendarError: "Google Calendar connection failed." });
    }
    return response;
  }
}
