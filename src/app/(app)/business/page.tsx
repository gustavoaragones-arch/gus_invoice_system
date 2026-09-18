import Link from "next/link";
import { BusinessForm } from "@/components/business/BusinessForm";
import { getServerAuthContext } from "@/server/auth/session";
import { listBusinesses, requireSelectedBusiness } from "@/server/application/businessContext";
import { getBusinessProfile } from "@/server/application/business";

export default async function BusinessPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const profile = await getBusinessProfile(auth, business.id);
  const businesses = await listBusinesses(auth);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Business profile</h1>
          <p>Manage the selected business profile used for invoices and delivery.</p>
        </div>
        <Link className="btn btn-secondary" href="/business/new">Create business</Link>
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Business administration</h2>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          {businesses.length} business profile{businesses.length === 1 ? "" : "es"} available in your account.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/business/tax">Tax configuration</Link>
          <Link className="btn btn-secondary" href="/reports">Reporting (calendar YTD)</Link>
        </div>
      </section>

      <BusinessForm
        mode="edit"
        initial={{
          name: profile.name,
          legalName: profile.legalName ?? "",
          address: profile.address ?? "",
          gstHstRegistrationNumber: profile.gstHstRegistrationNumber ?? "",
          brandingLogoRef: profile.brandingLogoRef ?? "",
        }}
      />
    </div>
  );
}
