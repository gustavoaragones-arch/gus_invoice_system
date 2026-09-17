"use client";

export function ClientSearch({ initialQuery }: { initialQuery: string }) {
  return (
    <form method="get" className="card" style={{ display: "flex", gap: "0.75rem", alignItems: "end" }}>
      <div className="field" style={{ flex: 1 }}>
        <label htmlFor="q">Search clients</label>
        <input id="q" name="q" defaultValue={initialQuery} placeholder="Name or email" />
      </div>
      <button className="btn btn-secondary" type="submit">Search</button>
    </form>
  );
}
