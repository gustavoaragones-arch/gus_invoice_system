import type { Tx } from "@/server/db/authorizedTransaction";

/**
 * Allocates the next sequential invoice number for a Business, atomically,
 * as part of the caller's finalization transaction (DEC-INV-002/003/004/005;
 * INV-NUM-001..005).
 *
 * Mechanism: a Postgres transaction-scoped advisory lock keyed by the
 * business id serializes concurrent finalizations for the *same* business
 * (finalizations for different businesses never block each other), then
 * the next number is computed as one more than the highest existing
 * *numeric* invoice number for that business. The lock is released
 * automatically at transaction end (commit or rollback) — if finalization
 * fails after this point, the transaction rolls back and no number is
 * consumed (Section 10/11 of the Phase 3 brief).
 *
 * Format: a plain increasing integer string ("1", "2", "3", ...). This is
 * the narrowest architecture-compatible placeholder (Section 27 of the
 * Phase 3 brief) for invoice number *format*, which Phase 1 (DEC-INV-009)
 * and Phase 2 (DEC-ARCH-027) explicitly leave as BUSINESS CONFIGURATION.
 * It deliberately does not invent a prefix, zero-padding, or year
 * component. Historical, non-numeric imported invoice numbers
 * (DEC-HIST-005) are preserved exactly as imported and are excluded from
 * this MAX computation — reconciling the historical sequence with this
 * one remains the explicitly UNRESOLVED item recorded in
 * docs/phase-1/11-accounting-decision-register.md and carried into
 * docs/phase-2/17-architecture-decision-register.md as DEC-ARCH-021.
 */
export async function allocateNextInvoiceNumber(tx: Tx, businessId: string): Promise<string> {
  // Postgres advisory locks take a 64-bit (bigint) key; hashtextextended
  // gives a stable, evenly-distributed bigint from the business id text.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}::text, 0))`;

  const rows = await tx.$queryRaw<{ max_number: number | null }[]>`
    SELECT MAX(invoice_number::bigint) AS max_number
    FROM "invoice"
    WHERE business_id = ${businessId}::uuid
      AND invoice_number IS NOT NULL
      AND invoice_number ~ '^[0-9]+$'
  `;

  const currentMax = rows[0]?.max_number ?? 0;
  const next = BigInt(currentMax) + 1n;
  return next.toString();
}
