"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BusinessSelector({
  businesses,
  selectedBusinessId,
}: {
  businesses: Array<{ id: string; name: string }>;
  selectedBusinessId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleChange(businessId: string) {
    setError(null);
    const response = await fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Unable to switch business.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (businesses.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>No businesses available</span>;
  }

  return (
    <div className="field" style={{ minWidth: "240px" }}>
      <label htmlFor="business-selector">Business</label>
      <select
        id="business-selector"
        value={selectedBusinessId ?? businesses[0]?.id ?? ""}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
      >
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>
            {business.name}
          </option>
        ))}
      </select>
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
