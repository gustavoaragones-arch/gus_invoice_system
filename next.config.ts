import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (Phase 11). Next.js App Router emits inline
 * bootstrap scripts, so `script-src` must allow 'unsafe-inline' unless a
 * per-request nonce is threaded through middleware and every page is
 * rendered dynamically — an architecture change outside Phase 11 (see
 * docs/phase-11/README.md, limitations). Everything else is locked down:
 * no framing, no plugins, same-origin connections/forms only.
 *
 * Supabase Auth and SMTP are called server-side only and Google OAuth is a
 * top-level redirect, so none of them require browser-side allowances.
 * The CSP is not applied to /api/* responses (notably the invoice PDF, whose
 * built-in viewer can be broken by a restrictive document policy); those
 * still receive every other header below.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Domain/persistence code lives under src/server and must never be
  // pulled into a client bundle. serverExternalPackages keeps Prisma's
  // native engine out of the client compilation graph.
  serverExternalPackages: ["@prisma/client", "pdfkit"],
  async headers() {
    const headers = [
      { source: "/:path*", headers: commonSecurityHeaders },
      {
        source: "/((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
    if (!isDev) {
      headers.push({
        source: "/:path*",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }],
      });
    }
    return headers;
  },
};

export default nextConfig;
