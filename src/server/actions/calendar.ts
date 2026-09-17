"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  connectCalendarForBusiness,
  createInvoiceDraftFromWorkCandidate,
  disconnectCalendarForBusiness,
  editWorkCandidateForBusiness,
  rejectWorkCandidateForBusiness,
  saveCalendarSelectionsForBusiness,
  syncCalendarsForBusiness,
} from "@/server/application/calendar";
import { actionFailure, actionSuccess } from "./errors";

export async function connectCalendarAction() {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const connection = await connectCalendarForBusiness(auth, business.id);
    revalidatePath("/calendar");
    return actionSuccess(connection);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function disconnectCalendarAction(connectionId: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await disconnectCalendarForBusiness(auth, business.id, connectionId);
    revalidatePath("/calendar");
    return actionSuccess({ ok: true });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveCalendarSelectionsAction(
  connectionId: string,
  selections: Array<{ googleCalendarId: string; displayName: string; selected: boolean }>,
) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const saved = await saveCalendarSelectionsForBusiness(auth, business.id, connectionId, selections);
    revalidatePath("/calendar");
    return actionSuccess(saved);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function syncCalendarsAction(connectionId: string, startDate: string, endDate: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const result = await syncCalendarsForBusiness(auth, business.id, connectionId, {
      start: new Date(startDate),
      end: new Date(endDate),
    });
    revalidatePath("/calendar");
    return actionSuccess(result);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function editWorkCandidateAction(
  workCandidateId: string,
  input: {
    clientId?: string;
    serviceId?: string;
    editedDescription?: string;
    editedQuantity?: string;
  },
) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const updated = await editWorkCandidateForBusiness(auth, business.id, workCandidateId, input);
    revalidatePath("/calendar");
    return actionSuccess(updated);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function rejectWorkCandidateAction(workCandidateId: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await rejectWorkCandidateForBusiness(auth, business.id, workCandidateId);
    revalidatePath("/calendar");
    return actionSuccess({ ok: true });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createInvoiceDraftFromWorkCandidateAction(workCandidateId: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const draft = await createInvoiceDraftFromWorkCandidate(auth, business.id, workCandidateId);
    revalidatePath("/calendar");
    redirect(`/invoices/${draft.id}`);
  } catch (error) {
    return actionFailure(error);
  }
}
