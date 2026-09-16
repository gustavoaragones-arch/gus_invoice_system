import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/server/auth/requireAuth";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { ensureUserProvisioned } from "@/server/domain/userProvisioning";
import { toErrorResponse } from "@/server/http/errorResponse";

/**
 * Illustrative example of the full layered stack this phase builds
 * (Section 4 of the Phase 3 brief): Authentication → Authorization →
 * Business boundary → Domain/application services → Persistence. This is
 * not a product API surface (no UI consumes it yet) — it exists so the
 * foundation is provably wired end-to-end, not just present as isolated
 * modules with no route ever exercising them together.
 *
 * GET  — lists the businesses owned by the authenticated user.
 * POST — creates a new business owned by the authenticated user.
 *
 * Both handlers authenticate first, then run inside
 * withAuthorizedTransaction so Row-Level Security is in effect for the
 * whole operation, then let RLS itself enforce "owned by this user" for
 * the read (no additional businessId to authorize against, since the
 * caller isn't targeting one specific business here).
 */

const createBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  gstHstRegistrationNumber: z.string().max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const businesses = await withAuthorizedTransaction(auth, (tx) =>
      tx.business.findMany({ orderBy: { createdAt: "asc" } }),
    );
    return NextResponse.json({ businesses });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const body = createBusinessSchema.parse(await request.json());

    const business = await withAuthorizedTransaction(auth, async (tx) => {
      await ensureUserProvisioned(tx, auth);
      return tx.business.create({
        data: {
          ownerUserId: auth.userId,
          name: body.name,
          legalName: body.legalName,
          address: body.address,
          gstHstRegistrationNumber: body.gstHstRegistrationNumber,
        },
      });
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body.", issues: error.issues }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
