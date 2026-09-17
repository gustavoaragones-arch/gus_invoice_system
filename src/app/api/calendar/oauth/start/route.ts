import { NextResponse } from "next/server";
import { getServerAuthContext, getSelectedBusinessId } from "@/server/auth/session";
import { assertGoogleCalendarConfigured } from "@/server/calendar/googleCalendarConfig";
import { buildGoogleAuthorizationUrl, createGoogleOAuthState } from "@/server/calendar/googleOAuth";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { toErrorResponse } from "@/server/http/errorResponse";

export async function GET() {
  try {
    assertGoogleCalendarConfigured();
    const auth = await getServerAuthContext();
    const businessId = await getSelectedBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "No business selected." }, { status: 400 });
    }

    await withAuthorizedTransaction(auth, async (tx) => {
      await assertBusinessAccess(tx, auth, businessId);
    });

    const state = await createGoogleOAuthState({ userId: auth.userId, businessId });
    const authorizationUrl = buildGoogleAuthorizationUrl(state);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return toErrorResponse(error);
  }
}
