import { BusinessForm } from "@/components/business/BusinessForm";

export default function NewBusinessPage() {
  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Create business</h1>
          <p>Add a new business profile for billing and reporting.</p>
        </div>
      </div>
      <BusinessForm mode="create" />
    </div>
  );
}
