"use client";

import { useRouter } from "next/navigation";

export function ReportsPeriodControls({
  periodKind,
  startDate,
  endDate,
}: {
  periodKind: "calendar-ytd" | "custom";
  startDate?: string;
  endDate?: string;
}) {
  const router = useRouter();

  return (
    <section className="card stack" aria-label="Reporting period controls">
      <h2 style={{ margin: 0 }}>Reporting period</h2>
      <p style={{ color: "var(--text-muted)", margin: 0 }}>
        Calendar YTD uses January 1 through today. Custom periods are inclusive on both dates.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn ${periodKind === "calendar-ytd" ? "btn-primary" : ""}`}
          onClick={() => router.push("/reports?period=calendar-ytd")}
        >
          Calendar YTD
        </button>
      </div>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const start = String(formData.get("startDate") ?? "");
          const end = String(formData.get("endDate") ?? "");
          router.push(`/reports?period=custom&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        }}
      >
        <div className="grid-2">
          <label className="stack" style={{ gap: "0.35rem" }}>
            <span>Start date</span>
            <input
              className="input"
              type="date"
              name="startDate"
              required
              defaultValue={startDate ?? ""}
            />
          </label>
          <label className="stack" style={{ gap: "0.35rem" }}>
            <span>End date</span>
            <input
              className="input"
              type="date"
              name="endDate"
              required
              defaultValue={endDate ?? ""}
            />
          </label>
        </div>
        <button type="submit" className={`btn ${periodKind === "custom" ? "btn-primary" : ""}`}>
          Apply custom period
        </button>
      </form>
    </section>
  );
}
