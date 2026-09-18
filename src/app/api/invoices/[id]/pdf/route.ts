import { NextResponse } from "next/server";
import { getServerAuthContext, isUuid } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getFinalizedInvoicePdf } from "@/server/application/invoicePdf";
import { toErrorResponse } from "@/server/http/errorResponse";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    const { filename, content } = await getFinalizedInvoicePdf(auth, business.id, id);

    const download = new URL(request.url).searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
