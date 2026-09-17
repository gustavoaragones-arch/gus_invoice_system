import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/domain/errors";
import {
  connectCalendarForBusiness,
  createInvoiceDraftFromWorkCandidate,
  discoverCalendarsForBusiness,
  editWorkCandidateForBusiness,
  getCalendarConnectionForBusiness,
  getCalendarWorkspace,
  getWorkCandidateForBusiness,
  rejectWorkCandidateForBusiness,
  saveCalendarSelectionsForBusiness,
  syncCalendarsForBusiness,
} from "@/server/application/calendar";
import { authFor, createFullTestFixture, createTestUser, withTx } from "../support/factories";

async function connectAndSelectPrimaryCalendar(
  auth: Awaited<ReturnType<typeof createFullTestFixture>>["auth"],
  businessId: string,
) {
  const connection = await connectCalendarForBusiness(auth, businessId);
  const calendars = await discoverCalendarsForBusiness(auth, businessId, connection.id);
  await saveCalendarSelectionsForBusiness(
    auth,
    businessId,
    connection.id,
    calendars.map((calendar, index) => ({
      googleCalendarId: calendar.googleCalendarId,
      displayName: calendar.displayName,
      selected: index === 0,
    })),
  );
  return { connection, selectedCalendarId: calendars[0]?.googleCalendarId };
}

describe("Phase 6 calendar workflow", () => {
  it("establishes a development calendar connection scoped to the business", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarForBusiness(auth, business.id);

    expect(connection.businessId).toBe(business.id);
    expect(connection.status).toBe("ACTIVE");
    expect(connection.googleAccountEmail).toBe("dev-calendar@example.test");
    expect(connection.accessTokenCiphertext).toBeTruthy();
    expect(connection.refreshTokenCiphertext).toBeTruthy();
  });

  it("rejects unauthorized calendar access", async () => {
    const { business } = await createFullTestFixture();
    const otherUser = await createTestUser();
    const otherAuth = authFor(otherUser);

    await expect(connectCalendarForBusiness(otherAuth, business.id)).rejects.toThrow();
  });

  it("rejects cross-business calendar connection access", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
    const connectionB = await connectCalendarForBusiness(fixtureB.auth, fixtureB.business.id);

    await expect(
      getCalendarConnectionForBusiness(fixtureA.auth, fixtureA.business.id, connectionB.id),
    ).rejects.toThrow();
  });

  it("discovers calendars and persists selected calendars", async () => {
    const { auth, business } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    const workspace = await getCalendarWorkspace(auth, business.id);

    expect(workspace.connection?.selectedCalendars).toHaveLength(2);
    expect(workspace.connection?.selectedCalendars.filter((calendar) => calendar.selected)).toHaveLength(1);
    expect(workspace.connection?.id).toBe(connection.id);
  });

  it("ingests events only from selected calendars and remains idempotent on repeat sync", async () => {
    const { auth, business } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    const range = { start: new Date("2025-01-01"), end: new Date("2025-12-31") };

    const firstSync = await syncCalendarsForBusiness(auth, business.id, connection.id, range);
    expect(firstSync.selectedCalendarsProcessed).toBe(1);
    expect(firstSync.eventsUpserted).toBeGreaterThan(0);
    expect(firstSync.candidatesCreated).toBeGreaterThan(0);

    const workspaceAfterFirst = await getCalendarWorkspace(auth, business.id);
    const eventCount = workspaceAfterFirst.events.length;
    const candidateCount = workspaceAfterFirst.workCandidates.length;

    const secondSync = await syncCalendarsForBusiness(auth, business.id, connection.id, range);
    expect(secondSync.eventsUpserted).toBeGreaterThan(0);
    expect(secondSync.candidatesCreated).toBe(0);

    const workspaceAfterSecond = await getCalendarWorkspace(auth, business.id);
    expect(workspaceAfterSecond.events).toHaveLength(eventCount);
    expect(workspaceAfterSecond.workCandidates).toHaveLength(candidateCount);
  });

  it("does not ingest events when no calendars are selected", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarForBusiness(auth, business.id);
    const calendars = await discoverCalendarsForBusiness(auth, business.id, connection.id);
    await saveCalendarSelectionsForBusiness(
      auth,
      business.id,
      connection.id,
      calendars.map((calendar) => ({
        googleCalendarId: calendar.googleCalendarId,
        displayName: calendar.displayName,
        selected: false,
      })),
    );

    await expect(
      syncCalendarsForBusiness(auth, business.id, connection.id, {
        start: new Date("2025-01-01"),
        end: new Date("2025-12-31"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps work candidates separate from invoices until explicit draft creation", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const workspace = await getCalendarWorkspace(auth, business.id);
    const candidate = workspace.workCandidates[0];
    expect(candidate).toBeTruthy();
    expect(candidate?.reviewState).toBe("PENDING");
    expect(candidate?.lineItems).toHaveLength(0);

    await expect(
      createInvoiceDraftFromWorkCandidate(auth, business.id, candidate!.id),
    ).rejects.toBeInstanceOf(ValidationError);

    await editWorkCandidateForBusiness(auth, business.id, candidate!.id, {
      clientId: client.id,
      serviceId: service.id,
      editedDescription: "Reviewed consulting work",
      editedQuantity: "2",
    });

    const draft = await createInvoiceDraftFromWorkCandidate(auth, business.id, candidate!.id);
    expect(draft.status).toBe("DRAFT");

    const reviewed = await getWorkCandidateForBusiness(auth, business.id, candidate!.id);
    expect(reviewed.reviewState).toBe("APPROVED");
  });

  it("rejects invoice draft creation for rejected work candidates", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const candidate = (await getCalendarWorkspace(auth, business.id)).workCandidates[0];
    expect(candidate).toBeTruthy();

    await editWorkCandidateForBusiness(auth, business.id, candidate!.id, {
      clientId: client.id,
      serviceId: service.id,
      editedDescription: "Rejected work",
      editedQuantity: "1",
    });
    await rejectWorkCandidateForBusiness(auth, business.id, candidate!.id);

    await expect(
      createInvoiceDraftFromWorkCandidate(auth, business.id, candidate!.id),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces business isolation for calendar events and work candidates", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(fixtureB.auth, fixtureB.business.id);
    await syncCalendarsForBusiness(fixtureB.auth, fixtureB.business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const workspaceB = await getCalendarWorkspace(fixtureB.auth, fixtureB.business.id);
    const candidateB = workspaceB.workCandidates[0];
    expect(candidateB).toBeTruthy();

    await expect(
      getWorkCandidateForBusiness(fixtureA.auth, fixtureA.business.id, candidateB!.id),
    ).rejects.toThrow();

    const workspaceA = await getCalendarWorkspace(fixtureA.auth, fixtureA.business.id);
    expect(workspaceA.workCandidates.some((candidate) => candidate.id === candidateB!.id)).toBe(false);
    expect(workspaceA.events.some((event) => event.id === workspaceB.events[0]?.id)).toBe(false);
  });

  it("preserves calendar event evidence without creating payments or finalized invoices", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const candidate = (await getCalendarWorkspace(auth, business.id)).workCandidates[0];
    await editWorkCandidateForBusiness(auth, business.id, candidate!.id, {
      clientId: client.id,
      serviceId: service.id,
      editedDescription: "Evidence-only review",
      editedQuantity: "1",
    });
    const draft = await createInvoiceDraftFromWorkCandidate(auth, business.id, candidate!.id);

    const invoice = await withTx(auth, (tx) =>
      tx.invoice.findUnique({
        where: { id: draft.id },
        include: { payments: true, lineItems: true },
      }),
    );

    expect(invoice?.status).toBe("DRAFT");
    expect(invoice?.payments).toHaveLength(0);
    expect(invoice?.lineItems[0]?.workCandidateId).toBe(candidate!.id);
  });

  it("rejects draft creation when candidate review is incomplete", async () => {
    const { auth, business } = await createFullTestFixture();
    const { connection } = await connectAndSelectPrimaryCalendar(auth, business.id);
    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const candidate = (await getCalendarWorkspace(auth, business.id)).workCandidates[0];
    await expect(
      createInvoiceDraftFromWorkCandidate(auth, business.id, candidate!.id),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
