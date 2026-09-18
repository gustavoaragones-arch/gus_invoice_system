import Link from "next/link";
import { TaxConfigurationForm } from "@/components/tax/TaxConfigurationForm";

export default function NewTaxConfigurationPage() {
  const suggestedEffectiveFrom = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>New tax configuration version</h1>
          <p>Create a new effective-dated tax configuration version for the selected business.</p>
        </div>
        <Link className="btn btn-secondary" href="/business/tax">Back to tax configuration</Link>
      </div>
      <TaxConfigurationForm suggestedEffectiveFrom={suggestedEffectiveFrom} />
    </div>
  );
}
