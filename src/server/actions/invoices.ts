"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  createInvoiceDraft,
  createReplacementDraftForBusiness,
  finalizeInvoiceForBusiness,
  saveDraftLineItems,
  updateDraftInvoice,
  voidInvoiceForBusiness,
} from "@/server/application/invoices";
import { actionFailure, actionSuccess } from "./errors";

export async function createInvoiceAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const invoice = await createInvoiceDraft(auth, business.id, {
      clientId: String(formData.get("clientId") ?? ""),
      invoiceDate: formData.get("invoiceDate") ? new Date(String(formData.get("invoiceDate"))) : undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : undefined,
    });
    redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateInvoiceAction(invoiceId: string, formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await updateDraftInvoice(auth, business.id, invoiceId, {
      clientId: String(formData.get("clientId") ?? "") || undefined,
      invoiceDate: formData.get("invoiceDate") ? new Date(String(formData.get("invoiceDate"))) : null,
      notes: String(formData.get("notes") ?? ""),
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
    });
    revalidatePath(`/invoices/${invoiceId}`);
    return actionSuccess({ ok: true });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveInvoiceLinesAction(
  invoiceId: string,
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxStatus: "TAXABLE" | "ZERO_RATED" | "EXEMPT";
    serviceId?: string;
  }>,
) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await saveDraftLineItems(auth, business.id, invoiceId, lines);
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath(`/invoices/${invoiceId}/review`);
    return actionSuccess({ ok: true });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function finalizeInvoiceAction(invoiceId: string, invoiceDate?: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await finalizeInvoiceForBusiness(
      auth,
      business.id,
      invoiceId,
      invoiceDate ? new Date(invoiceDate) : undefined,
    );
    revalidatePath(`/invoices/${invoiceId}`);
    redirect(`/invoices/${invoiceId}`);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function voidInvoiceAction(invoiceId: string, reason: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    await voidInvoiceForBusiness(auth, business.id, invoiceId, reason || undefined);
    revalidatePath(`/invoices/${invoiceId}`);
    return actionSuccess({ ok: true });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createReplacementAction(invoiceId: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const replacement = await createReplacementDraftForBusiness(auth, business.id, invoiceId);
    redirect(`/invoices/${replacement.id}`);
  } catch (error) {
    return actionFailure(error);
  }
}
