import { ClientForm } from "@/components/clients/ClientForm";

export default function NewClientPage() {
  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Create client</h1>
          <p>Add a new bill-to party.</p>
        </div>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
