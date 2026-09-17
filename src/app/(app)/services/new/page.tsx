import { ServiceForm } from "@/components/services/ServiceForm";

export default function NewServicePage() {
  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Create service</h1>
          <p>Add a billable service to the catalog.</p>
        </div>
      </div>
      <ServiceForm mode="create" />
    </div>
  );
}
