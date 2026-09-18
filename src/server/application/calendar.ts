import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { getCalendarProviderMode } from "@/server/calendar/googleCalendarConfig";
import type { CalendarProviderConnectionResult } from "@/server/calendar/types";
import {
  connectCalendar,
  connectCalendarFromOAuth,
  disconnectCalendar,
  getActiveCalendarConnection,
} from "@/server/domain/calendarConnection";
import { discoverProviderCalendars, saveCalendarSelections } from "@/server/domain/calendarSelection";
import { syncSelectedCalendars } from "@/server/domain/calendarSync";
import {
  approveWorkCandidate,
  editWorkCandidate,
  rejectWorkCandidate,
} from "@/server/domain/calendarBoundary";
import { createDraftInvoice } from "@/server/domain/invoiceLifecycle";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

export async function getCalendarWorkspace(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const connection = await getActiveCalendarConnection(tx, auth, businessId);
    const workCandidates = await tx.workCandidate.findMany({
      where: { businessId },
      include: {
        calendarEvent: {
          include: { selectedCalendar: true },
        },
        lineItems: { select: { invoiceId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const events = connection
      ? await tx.calendarEvent.findMany({
          where: { selectedCalendar: { calendarConnectionId: connection.id } },
          include: {
            selectedCalendar: true,
            workCandidates: true,
          },
          orderBy: [{ startAt: "desc" }, { retrievedAt: "desc" }],
          take: 50,
        })
      : [];

    return { connection, workCandidates, events };
  });
}

export function getCalendarProviderModeForApp(): "development" | "google" {
  return getCalendarProviderMode();
}

export async function connectCalendarForBusiness(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, (tx) => connectCalendar(tx, auth, businessId));
}

export async function connectCalendarFromOAuthForBusiness(
  auth: AuthContext,
  businessId: string,
  providerResult: CalendarProviderConnectionResult,
) {
  return withAuthorizedTransaction(auth, (tx) => connectCalendarFromOAuth(tx, auth, businessId, providerResult));
}

export async function disconnectCalendarForBusiness(
  auth: AuthContext,
  businessId: string,
  connectionId: string,
) {
  return withAuthorizedTransaction(auth, (tx) => disconnectCalendar(tx, auth, connectionId, businessId));
}

export async function discoverCalendarsForBusiness(
  auth: AuthContext,
  businessId: string,
  connectionId: string,
) {
  return withAuthorizedTransaction(auth, (tx) => discoverProviderCalendars(tx, auth, businessId, connectionId));
}

export async function saveCalendarSelectionsForBusiness(
  auth: AuthContext,
  businessId: string,
  connectionId: string,
  selections: Array<{ googleCalendarId: string; displayName: string; selected: boolean }>,
) {
  return withAuthorizedTransaction(auth, (tx) =>
    saveCalendarSelections(tx, auth, businessId, connectionId, selections),
  );
}

export async function syncCalendarsForBusiness(
  auth: AuthContext,
  businessId: string,
  connectionId: string,
  range: { start: Date; end: Date },
) {
  return withAuthorizedTransaction(auth, (tx) =>
    syncSelectedCalendars(tx, auth, businessId, connectionId, range),
  );
}

export async function editWorkCandidateForBusiness(
  auth: AuthContext,
  businessId: string,
  workCandidateId: string,
  edits: { clientId?: string; serviceId?: string; editedDescription?: string; editedQuantity?: string },
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const candidate = await tx.workCandidate.findFirst({ where: { id: workCandidateId, businessId } });
    if (!candidate) throw new NotFoundError("Work candidate not found.");
    return editWorkCandidate(tx, auth, workCandidateId, edits);
  });
}

export async function rejectWorkCandidateForBusiness(
  auth: AuthContext,
  businessId: string,
  workCandidateId: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const candidate = await tx.workCandidate.findFirst({ where: { id: workCandidateId, businessId } });
    if (!candidate) throw new NotFoundError("Work candidate not found.");
    return rejectWorkCandidate(tx, auth, workCandidateId);
  });
}

export async function createInvoiceDraftFromWorkCandidate(
  auth: AuthContext,
  businessId: string,
  workCandidateId: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const candidate = await tx.workCandidate.findFirst({ where: { id: workCandidateId, businessId } });
    if (!candidate) throw new NotFoundError("Work candidate not found.");

    if (candidate.reviewState === "APPROVED" || candidate.reviewState === "REJECTED") {
      throw new ValidationError("This work candidate has already been reviewed.");
    }
    if (!candidate.clientId || !candidate.editedDescription || !candidate.editedQuantity) {
      throw new ValidationError(
        "Assign a client, description, and quantity before creating an invoice draft.",
      );
    }

    const draft = await createDraftInvoice(tx, auth, {
      businessId,
      clientId: candidate.clientId,
    });

    await approveWorkCandidate(tx, auth, workCandidateId, draft.id, 1);
    return draft;
  });
}

export async function getCalendarConnectionForBusiness(
  auth: AuthContext,
  businessId: string,
  connectionId: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const connection = await tx.calendarConnection.findFirst({
      where: { id: connectionId, businessId },
    });
    if (!connection) throw new NotFoundError("Calendar connection not found.");
    return connection;
  });
}

export async function getWorkCandidateForBusiness(
  auth: AuthContext,
  businessId: string,
  workCandidateId: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const candidate = await tx.workCandidate.findFirst({
      where: { id: workCandidateId, businessId },
    });
    if (!candidate) throw new NotFoundError("Work candidate not found.");
    return candidate;
  });
}
