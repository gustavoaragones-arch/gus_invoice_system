import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessProfile, updateBusinessProfile } from "@/server/application/business";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  editWorkCandidateForBusiness,
  getCalendarWorkspace,
  getWorkCandidateForBusiness,
  rejectWorkCandidateForBusiness,
  syncCalendarsForBusiness,
} from "@/server/application/calendar";
import { getClient, listClients, updateClient } from "@/server/application/clients";
import { sendInvoiceForBusiness } from "@/server/application/delivery";
import { getInvoice, listInvoices, voidInvoiceForBusiness } from "@/server/application/invoices";
import { getFinalizedInvoicePdf } from "@/server/application/invoicePdf";
import {
  listInvoicePayments,
  recordPaymentForBusiness,
  reversePaymentForBusiness,
} from "@/server/application/payments";
import { getFinancialReport } from "@/server/application/reporting";
import { getService, listServices } from "@/server/application/services";
import {
  createTaxConfigurationForBusiness,
  listTaxConfigurations,
} from "@/server/application/taxConfiguration";
import { finalizeInvoiceForBusiness, createInvoiceDraft, saveDraftLineItems } from "@/server/application/invoices";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { prisma } from "@/server/db/client";
import { BusinessAuthorizationError, NotFoundError } from "@/server/domain/errors";
import { createFullTestFixture, withTx } from "../support/factories";

// ── next/headers is request-scoped; supply a controllable cookie jar so the
// real route handlers and session helpers can run under test.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => new Headers(),
}));

const JWT_SECRET = "phase11-integration-jwt-secret-with-enough-length-0123";

async function sessionFor(user: { id: string; email: string }) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

type Fixture = Awaited<ReturnType<typeof createFullTestFixture>>;

async function buildTenant(): Promise<
  Fixture & { invoiceId: string; paymentId: string; candidateId: string; connectionId: string }
> {
  const fixture = await createFullTestFixture();
  const { auth, business, client, service } = fixture;

  const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
  await saveDraftLineItems(auth, business.id, draft.id, [
    { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
  ]);
  const invoice = await finalizeInvoiceForBusiness(auth, business.id, draft.id, new Date("2025-03-01"));
  const payment = await recordPaymentForBusiness(auth, business.id, {
    invoiceId: invoice.id,
    amount: "25.00",
    paymentDate: new Date("2025-03-05"),
  });

  const { connectionId, candidateId } = await withTx(auth, async (tx) => {
    const connection = await tx.calendarConnection.create({ data: { businessId: business.id } });
    const calendar = await tx.selectedCalendar.create({
      data: { calendarConnectionId: connection.id, googleCalendarId: "primary", selected: true },
    });
    const event = await tx.calendarEvent.create({
      data: { selectedCalendarId: calendar.id, sourceEventId: `evt-${connection.id}`, title: "Private meeting" },
    });
    const candidate = await tx.workCandidate.create({
      data: { businessId: business.id, calendarEventId: event.id, editedDescription: "Meeting", editedQuantity: "1.00" },
    });
    return { connectionId: connection.id, candidateId: candidate.id };
  });

  return { ...fixture, invoiceId: invoice.id, paymentId: payment.id, candidateId, connectionId };
}

async function denied(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, "operation must be rejected").not.toBeNull();
  expect(
    error instanceof BusinessAuthorizationError || error instanceof NotFoundError,
    `expected authorization/not-found, got ${String(error)}`,
  ).toBe(true);
}

beforeEach(() => {
  cookieJar.clear();
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  delete process.env.AUTH_PROVIDER;
});

describe("Phase 11 cross-business isolation — application layer (A's session, B's resources)", () => {
  it("clients, services and business profile are isolated", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    await denied(listClients(a.auth, b.business.id));
    await denied(getClient(a.auth, a.business.id, b.client.id)); // valid business, foreign id
    await denied(getClient(a.auth, b.business.id, b.client.id));
    await denied(updateClient(a.auth, b.business.id, b.client.id, { name: "Hijacked" }));
    await denied(listServices(a.auth, b.business.id));
    await denied(getService(a.auth, a.business.id, b.service.id));
    await denied(getBusinessProfile(a.auth, b.business.id));
    await denied(
      updateBusinessProfile(a.auth, b.business.id, {
        name: "Hijacked",
        legalName: "",
        address: "",
        gstHstRegistrationNumber: "",
        brandingLogoRef: "",
      }),
    );

    const untouched = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${b.auth.userId}, true)`;
      return { client: await tx.client.findUniqueOrThrow({ where: { id: b.client.id } }), business: await tx.business.findUniqueOrThrow({ where: { id: b.business.id } }) };
    });
    expect(untouched.client.name).toBe(b.client.name);
    expect(untouched.business.name).toBe(b.business.name);
  });

  it("invoices, payments, PDF, delivery and void are isolated", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    await denied(listInvoices(a.auth, b.business.id));
    await denied(getInvoice(a.auth, a.business.id, b.invoiceId));
    await denied(getInvoice(a.auth, b.business.id, b.invoiceId));
    await denied(getFinalizedInvoicePdf(a.auth, a.business.id, b.invoiceId));
    await denied(getFinalizedInvoicePdf(a.auth, b.business.id, b.invoiceId));
    await denied(sendInvoiceForBusiness(a.auth, a.business.id, b.invoiceId, "x@example.test"));
    await denied(sendInvoiceForBusiness(a.auth, b.business.id, b.invoiceId, "x@example.test"));
    await denied(voidInvoiceForBusiness(a.auth, b.business.id, b.invoiceId, "hostile"));
    await denied(listInvoicePayments(a.auth, b.business.id, b.invoiceId));
    await denied(
      recordPaymentForBusiness(a.auth, a.business.id, { invoiceId: b.invoiceId, amount: "1.00", paymentDate: new Date() }),
    );
    await denied(
      recordPaymentForBusiness(a.auth, b.business.id, { invoiceId: b.invoiceId, amount: "1.00", paymentDate: new Date() }),
    );
    await denied(reversePaymentForBusiness(a.auth, a.business.id, { paymentId: b.paymentId }));
    await denied(reversePaymentForBusiness(a.auth, b.business.id, { paymentId: b.paymentId }));

    // B's data is exactly as before: still finalized, one un-reversed payment, no send attempts.
    const state = await withTx(b.auth, async (tx) => ({
      invoice: await tx.invoice.findUniqueOrThrow({ where: { id: b.invoiceId } }),
      payments: await tx.payment.findMany({ where: { invoiceId: b.invoiceId }, include: { reversal: true } }),
      attempts: await tx.invoiceSendAttempt.count({ where: { invoiceId: b.invoiceId } }),
    }));
    expect(state.invoice.status).toBe("FINALIZED");
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0]?.reversal).toBeNull();
    expect(state.attempts).toBe(0);
  });

  it("tax configuration is isolated", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    await denied(listTaxConfigurations(a.auth, b.business.id));
    await denied(
      createTaxConfigurationForBusiness(a.auth, b.business.id, {
        effectiveFrom: new Date("2030-01-01"),
        isGstHstRegistered: true,
        taxLines: [{ taxAuthority: "X", taxType: "Y", rate: "0.5" }],
      }),
    );
    const versions = await listTaxConfigurations(b.auth, b.business.id);
    expect(versions).toHaveLength(1);
  });

  it("Calendar connections, events and WorkCandidates are isolated", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    await denied(getCalendarWorkspace(a.auth, b.business.id));
    await denied(getWorkCandidateForBusiness(a.auth, a.business.id, b.candidateId));
    await denied(getWorkCandidateForBusiness(a.auth, b.business.id, b.candidateId));
    await denied(editWorkCandidateForBusiness(a.auth, b.business.id, b.candidateId, { editedDescription: "x" }));
    await denied(editWorkCandidateForBusiness(a.auth, a.business.id, b.candidateId, { editedDescription: "x" }));
    await denied(rejectWorkCandidateForBusiness(a.auth, b.business.id, b.candidateId));
    await denied(
      syncCalendarsForBusiness(a.auth, b.business.id, b.connectionId, {
        start: new Date("2025-01-01"),
        end: new Date("2025-02-01"),
      }),
    );

    const own = await getCalendarWorkspace(a.auth, a.business.id);
    expect(own.workCandidates.map((c) => c.id)).toEqual([a.candidateId]);
    expect(JSON.stringify(own)).not.toContain(b.candidateId);
  });

  it("reports never include another business's data", async () => {
    const a = await buildTenant();
    const b = await buildTenant();
    // make B distinguishable
    const draft = await createInvoiceDraft(b.auth, b.business.id, { clientId: b.client.id });
    await saveDraftLineItems(b.auth, b.business.id, draft.id, [
      { description: "B only", quantity: "1", unitPrice: "999.00", taxStatus: "TAXABLE", serviceId: b.service.id },
    ]);
    await finalizeInvoiceForBusiness(b.auth, b.business.id, draft.id, new Date("2025-03-02"));

    const period = { periodKind: "custom" as const, startDate: "2025-01-01", endDate: "2025-12-31" };
    const report = await getFinancialReport(a.auth, a.business.id, period);
    expect(report.summary.revenue).toBe("100.00");
    expect(report.summary.invoiceCount).toBe(1);
    expect(report.revenueInvoices.map((r) => r.id)).toEqual([a.invoiceId]);
    expect(JSON.stringify(report)).not.toContain(b.invoiceId);

    await denied(getFinancialReport(a.auth, b.business.id, period));
  });

  it("a tampered selected-business cookie cannot select another user's business", async () => {
    const a = await buildTenant();
    const b = await buildTenant();
    cookieJar.set("selected_business_id", b.business.id);
    await denied(requireSelectedBusiness(a.auth));

    cookieJar.set("selected_business_id", "not-a-uuid");
    const fallback = await requireSelectedBusiness(a.auth); // malformed value ignored, own business used
    expect(fallback.id).toBe(a.business.id);
  });
});

describe("Phase 11 cross-business isolation — database/RLS layer (application checks bypassed)", () => {
  it("unfiltered reads under A's session return none of B's rows in any business-owned table", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    const seen = await withAuthorizedTransaction(a.auth, async (tx) => ({
      businesses: (await tx.business.findMany()).map((r) => r.id),
      clients: (await tx.client.findMany()).map((r) => r.id),
      services: (await tx.service.findMany()).map((r) => r.id),
      invoices: (await tx.invoice.findMany()).map((r) => r.id),
      lineItems: (await tx.invoiceLineItem.findMany()).map((r) => r.invoiceId),
      taxLines: (await tx.invoiceTaxLine.findMany()).map((r) => r.invoiceId),
      payments: (await tx.payment.findMany()).map((r) => r.id),
      taxConfigs: (await tx.taxConfigurationVersion.findMany()).map((r) => r.businessId),
      connections: (await tx.calendarConnection.findMany()).map((r) => r.id),
      candidates: (await tx.workCandidate.findMany()).map((r) => r.id),
      events: (await tx.calendarEvent.findMany()).map((r) => r.sourceEventId),
      audit: (await tx.auditEvent.findMany()).map((r) => r.businessId),
    }));

    expect(seen.businesses).toContain(a.business.id);
    expect(seen.businesses).not.toContain(b.business.id);
    expect(seen.clients).not.toContain(b.client.id);
    expect(seen.services).not.toContain(b.service.id);
    expect(seen.invoices).toContain(a.invoiceId);
    expect(seen.invoices).not.toContain(b.invoiceId);
    expect(seen.lineItems).not.toContain(b.invoiceId);
    expect(seen.taxLines).not.toContain(b.invoiceId);
    expect(seen.payments).not.toContain(b.paymentId);
    expect(seen.taxConfigs).not.toContain(b.business.id);
    expect(seen.connections).not.toContain(b.connectionId);
    expect(seen.candidates).not.toContain(b.candidateId);
    expect(seen.events).not.toContain(`evt-${b.connectionId}`);
    expect(seen.audit).not.toContain(b.business.id);
  });

  it("writes into another business are rejected by RLS even without application checks", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    await expect(
      withAuthorizedTransaction(a.auth, (tx) => tx.client.create({ data: { businessId: b.business.id, name: "Injected" } })),
    ).rejects.toThrow();
    await expect(
      withAuthorizedTransaction(a.auth, (tx) =>
        tx.payment.create({ data: { invoiceId: b.invoiceId, amount: "1.00", paymentDate: new Date() } }),
      ),
    ).rejects.toThrow();

    const updated = await withAuthorizedTransaction(a.auth, (tx) =>
      tx.invoice.updateMany({ where: { id: b.invoiceId }, data: { notes: "tampered" } }),
    );
    expect(updated.count).toBe(0);
    const deleted = await withAuthorizedTransaction(a.auth, (tx) => tx.client.deleteMany({ where: { id: b.client.id } }));
    expect(deleted.count).toBe(0);
  });

  it("with no authenticated user context, every table is invisible (deny by default)", async () => {
    await buildTenant();
    const counts = await prisma.$transaction([
      prisma.business.count(),
      prisma.client.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.taxConfigurationVersion.count(),
      prisma.workCandidate.count(),
      prisma.calendarConnection.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("Phase 11 route security — /api/invoices/[id]/pdf handler", () => {
  async function callPdf(sessionUser: { id: string; email: string } | null, businessId: string | null, invoiceId: string) {
    cookieJar.clear();
    if (sessionUser) cookieJar.set("session_token", await sessionFor(sessionUser));
    if (businessId) cookieJar.set("selected_business_id", businessId);
    const { GET } = await import("@/app/api/invoices/[id]/pdf/route");
    return GET(new Request(`http://localhost/api/invoices/${invoiceId}/pdf`), {
      params: Promise.resolve({ id: invoiceId }),
    });
  }

  it("returns the PDF to the owning business and refuses everything else", async () => {
    const a = await buildTenant();
    const b = await buildTenant();

    const own = await callPdf(a.user, a.business.id, a.invoiceId);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("application/pdf");
    expect(own.headers.get("cache-control")).toContain("no-store");
    expect((await own.arrayBuffer()).byteLength).toBeGreaterThan(500);

    // authenticated as A, changing the invoice id to B's
    const swappedId = await callPdf(a.user, a.business.id, b.invoiceId);
    expect(swappedId.status).toBe(404);
    // authenticated as A, forcing B's business selection
    const forcedBusiness = await callPdf(a.user, b.business.id, b.invoiceId);
    expect(forcedBusiness.status).toBe(403);
    // unauthenticated
    expect((await callPdf(null, null, a.invoiceId)).status).toBe(401);
    // malformed identifiers never reach the database
    for (const bad of ["not-a-uuid", "../../etc/passwd", "1' OR '1'='1"]) {
      expect((await callPdf(a.user, a.business.id, bad)).status).toBe(404);
    }
  });

  it("does not leak details in any denial body", async () => {
    const a = await buildTenant();
    const b = await buildTenant();
    for (const response of [
      await callPdf(a.user, a.business.id, b.invoiceId),
      await callPdf(a.user, b.business.id, b.invoiceId),
      await callPdf(null, null, b.invoiceId),
    ]) {
      const text = await response.text();
      expect(text).not.toContain(b.invoiceId);
      expect(text).not.toContain(b.business.id);
      expect(text).not.toMatch(/prisma|postgres|SELECT|stack|node_modules/i);
    }
  });
});

describe("Phase 11 authenticated route and session behaviour", () => {
  it("/api/businesses rejects missing and invalid credentials and scopes results to the caller", async () => {
    const a = await buildTenant();
    await buildTenant();
    const { GET } = await import("@/app/api/businesses/route");

    cookieJar.clear();
    const anonymous = await GET(new Request("http://localhost/api/businesses"));
    expect(anonymous.status).toBe(401);

    const bad = await GET(new Request("http://localhost/api/businesses", { headers: { authorization: "Bearer garbage" } }));
    expect(bad.status).toBe(401);

    const good = await GET(
      new Request("http://localhost/api/businesses", { headers: { authorization: `Bearer ${await sessionFor(a.user)}` } }),
    );
    expect(good.status).toBe(200);
    const body = (await good.json()) as { businesses: Array<{ id: string }> };
    expect(body.businesses.map((x) => x.id)).toEqual([a.business.id]);
  });

  it("/api/business/select refuses a business the caller does not own and malformed ids", async () => {
    const a = await buildTenant();
    const b = await buildTenant();
    const { POST } = await import("@/app/api/business/select/route");
    const post = async (body: unknown) =>
      POST(
        new Request("http://localhost/api/business/select", {
          method: "POST",
          headers: { authorization: `Bearer ${await sessionFor(a.user)}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );

    expect((await post({ businessId: b.business.id })).status).toBe(403);
    expect((await post({ businessId: "nope" })).status).toBe(400);
    expect((await post({ businessId: a.business.id })).status).toBe(200);
    expect(cookieJar.get("selected_business_id")).toBe(a.business.id);
  });

  it("login route: development sign-in works outside production and is unavailable with the supabase provider without credentials", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const login = (body: string) =>
      POST(new Request("http://localhost/api/auth/login", { method: "POST", body, headers: { "content-type": "application/json" } }));

    expect((await login("{not json")).status).toBe(400);
    expect((await login(JSON.stringify({ email: "nope" }))).status).toBe(400);
    const ok = await login(JSON.stringify({ email: `dev-${Date.now()}@example.test` }));
    expect(ok.status).toBe(200);
    expect(cookieJar.get("session_token")).toBeTruthy();

    // supabase provider: a password is mandatory, so email-only sign-in is impossible
    process.env.AUTH_PROVIDER = "supabase";
    cookieJar.clear();
    const noPassword = await login(JSON.stringify({ email: "someone@example.test" }));
    expect(noPassword.status).toBe(400);
    expect(cookieJar.has("session_token")).toBe(false);
  });

  it("production without AUTH_PROVIDER cannot sign in at all (no development fallback)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { POST } = await import("@/app/api/auth/login/route");
      const response = await POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "attacker@example.test" }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(response.status).toBe(503);
      expect(cookieJar.has("session_token")).toBe(false);
      const text = await response.text();
      expect(text).not.toMatch(/AUTH_PROVIDER|development/i);
      const created = await prisma.user.count({ where: { email: "attacker@example.test" } });
      expect(created).toBe(0);
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });
});

describe("Phase 11 audit coverage for security-sensitive operations (existing AuditEvent model)", () => {
  it("finalization, payment recording and payment reversal produce audit events attributed to the actor", async () => {
    const a = await buildTenant();
    await reversePaymentForBusiness(a.auth, a.business.id, { paymentId: a.paymentId, reason: "test" });
    const events = await withTx(a.auth, (tx) =>
      tx.auditEvent.findMany({ where: { businessId: a.business.id } }),
    );
    const types = new Set(events.map((e) => e.eventType));
    for (const expected of ["INVOICE_CREATED", "INVOICE_FINALIZED", "PAYMENT_RECORDED", "PAYMENT_REVERSED"]) {
      expect(types.has(expected as never)).toBe(true);
    }
    expect(events.every((e) => e.actorUserId === a.auth.userId)).toBe(true);
  });
});
