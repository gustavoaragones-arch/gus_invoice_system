import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { BUSINESS_COOKIE, SESSION_COOKIE, createSessionToken } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { ensureUserProvisioned } from "@/server/domain/userProvisioning";
import { toErrorResponse } from "@/server/http/errorResponse";

const loginSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    const auth = { userId: user.id, email: user.email };
    await withAuthorizedTransaction(auth, (tx) => ensureUserProvisioned(tx, auth));

    const token = await createSessionToken(auth.userId, auth.email);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    cookieStore.delete(BUSINESS_COOKIE);

    return NextResponse.json({ ok: true, email: auth.email });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
