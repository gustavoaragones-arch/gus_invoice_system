import type { NextConfig } from "next";

/**
 * Phase 3 note: this is a minimal application shell. No product UI is
 * implemented in this phase (Phase 3 scope is the application foundation
 * and persistence layer only — see docs/phase-3).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Domain/persistence code lives under src/server and must never be
  // pulled into a client bundle. serverExternalPackages keeps Prisma's
  // native engine out of the client compilation graph.
  serverExternalPackages: ["@prisma/client", "pdfkit"],
};

export default nextConfig;
