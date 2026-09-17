import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";

export async function getOverviewData(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);

    const [draftCount, finalizedCount, voidCount, recentInvoices, clientCount, serviceCount] =
      await Promise.all([
        tx.invoice.count({ where: { businessId, status: "DRAFT" } }),
        tx.invoice.count({ where: { businessId, status: "FINALIZED" } }),
        tx.invoice.count({ where: { businessId, status: "VOID" } }),
        tx.invoice.findMany({
          where: { businessId },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        }),
        tx.client.count({ where: { businessId } }),
        tx.service.count({ where: { businessId } }),
      ]);

    const draftsNeedingReview = await tx.invoice.findMany({
      where: { businessId, status: "DRAFT" },
      include: { client: true, lineItems: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    return {
      counts: {
        drafts: draftCount,
        finalized: finalizedCount,
        voided: voidCount,
        clients: clientCount,
        services: serviceCount,
      },
      draftsNeedingReview: draftsNeedingReview.map((invoice) => ({
        id: invoice.id,
        clientName: invoice.client.name,
        lineItemCount: invoice.lineItems.length,
        updatedAt: invoice.updatedAt,
      })),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        status: invoice.status,
        invoiceTotal: invoice.invoiceTotal?.toString() ?? null,
        updatedAt: invoice.updatedAt,
      })),
    };
  });
}
