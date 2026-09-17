import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { BUSINESS_COOKIE } from "@/server/auth/session";
import { requireAuthContext } from "@/server/auth/requireAuth";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { toErrorResponse } from "@/server/http/errorResponse";

const schema = z.object({
  businessId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const body = schema.parse(await request.json());

    await withAuthorizedTransaction(auth, async (tx) => {
      await assertBusinessAccess(tx, auth, body.businessId);
    });

    const cookieStore = await cookies();
    cookieStore.set(BUSINESS_COOKIE, body.businessId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid business selection." }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
