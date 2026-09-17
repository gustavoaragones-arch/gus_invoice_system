import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/services/ServiceForm";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getService } from "@/server/application/services";

export default async function ServiceDetailPage({ params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);

  let service;
  try {
    service = await getService(auth, business.id, params.id);
  } catch {
    notFound();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>{service.description}</h1>
          <p>Edit service details used when creating invoice lines.</p>
        </div>
      </div>
      <ServiceForm
        mode="edit"
        serviceId={service.id}
        initial={{
          description: service.description,
          unit: service.unit,
          defaultRate: service.defaultRate.toString(),
          taxStatus: service.taxStatus,
          status: service.status,
        }}
      />
    </div>
  );
}
