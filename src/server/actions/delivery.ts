"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { sendInvoiceForBusiness } from "@/server/application/delivery";
import { actionFailure, actionSuccess } from "./errors";

export async function sendInvoiceAction(invoiceId: string, destinationEmail: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const attempt = await sendInvoiceForBusiness(auth, business.id, invoiceId, destinationEmail);
    revalidatePath(`/invoices/${invoiceId}`);
    return actionSuccess({ attemptId: attempt.id, status: attempt.status });
  } catch (error) {
    revalidatePath(`/invoices/${invoiceId}`);
    return actionFailure(error);
  }
}
