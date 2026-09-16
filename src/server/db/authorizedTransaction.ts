import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client";
import type { AuthContext } from "@/server/auth/types";

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Runs `work` inside a single database transaction with the Postgres
 * session variable `app.user_id` set to the authenticated user's id for
 * the lifetime of that transaction (SET LOCAL semantics — scoped to this
 * transaction only, never leaks to another request on a pooled
 * connection).
 *
 * Every RLS policy in prisma/migrations/*_invariant_constraints reads
 * this variable via `app_current_business_ids()`. This is the mechanism
 * that makes Row-Level Security (SEC-ISO-004, INV-ISO-*) actually take
 * effect — without it, `current_setting('app.user_id', true)` is NULL and
 * every policy denies by default (fail closed, not fail open).
 *
 * This is the *second*, independent layer of business isolation. The
 * primary layer is application-level: every domain function additionally
 * calls `assertBusinessAccess` (see businessAuthorization.ts) before
 * touching business data. Neither layer is allowed to be the only one.
 */
export async function withAuthorizedTransaction<T>(
  auth: AuthContext,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${auth.userId}, true)`;
    return work(tx as unknown as Tx);
  });
}

/**
 * For call sites that already hold a transaction client (e.g. composing
 * one domain operation from another within the same finalizeInvoice
 * transaction) and only need typed raw-SQL access, not a new transaction.
 */
export type { Prisma };
