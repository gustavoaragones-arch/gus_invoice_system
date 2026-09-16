import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

/**
 * Minimal liveness/readiness check. Confirms the application can reach the
 * configured PostgreSQL/Supabase database. Exposes no business data and
 * requires no authentication (it reveals nothing about businesses, clients,
 * or financial records — consistent with SEC-EXPOSE-001).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
}
