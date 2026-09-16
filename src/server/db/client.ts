import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client instance. Next.js dev-mode hot reload can otherwise
 * create a new PrismaClient (and a new connection pool) on every reload;
 * caching it on `globalThis` avoids exhausting the database's connection
 * limit. This module must only ever be imported from server-side code
 * (route handlers, domain services) — never from a client component.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
