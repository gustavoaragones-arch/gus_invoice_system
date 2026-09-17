"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { recordPaymentForBusiness, reversePaymentForBusiness } from "@/server/application/payments";
import { actionFailure, actionSuccess } from "./errors";

export async function recordPaymentAction(
  invoiceId: string,
  input: { amount: string; paymentDate: string; method?: string; notes?: string },
) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId,
      amount: input.amount,
      paymentDate: new Date(input.paymentDate),
      method: input.method,
      notes: input.notes,
    });
    revalidatePath(`/invoices/${invoiceId}`);
    return actionSuccess(payment);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reversePaymentAction(invoiceId: string, paymentId: string, reason: string) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const reversal = await reversePaymentForBusiness(auth, business.id, {
      paymentId,
      reason: reason || undefined,
    });
    revalidatePath(`/invoices/${invoiceId}`);
    return actionSuccess(reversal);
  } catch (error) {
    return actionFailure(error);
  }
}
