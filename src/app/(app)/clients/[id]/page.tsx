import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getClient } from "@/server/application/clients";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);

  let client;
  try {
    client = await getClient(auth, business.id, params.id);
  } catch {
    notFound();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>{client.name}</h1>
          <p>Edit client details for future invoices.</p>
        </div>
      </div>
      <ClientForm
        mode="edit"
        clientId={client.id}
        initial={{
          name: client.name,
          billingAddress: client.billingAddress ?? "",
          contactEmail: client.contactEmail ?? "",
          status: client.status,
        }}
      />
    </div>
  );
}
