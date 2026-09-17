"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInvoiceDraftFromWorkCandidateAction,
  editWorkCandidateAction,
  rejectWorkCandidateAction,
} from "@/server/actions/calendar";
import { formatDate, formatStatus } from "@/lib/format";

export function WorkCandidateReview({
  candidate,
  clients,
  services,
}: {
  candidate: {
    id: string;
    reviewState: "PENDING" | "EDITED" | "APPROVED" | "REJECTED";
    clientId: string | null;
    serviceId: string | null;
    editedDescription: string | null;
    editedQuantity: { toString(): string } | null;
    matchConfidence: "MATCHED" | "UNMATCHED" | null;
    calendarEvent: {
      title: string | null;
      startAt: Date | null;
      endAt: Date | null;
      description: string | null;
      selectedCalendar: { displayName: string | null };
    };
    lineItems: Array<{ invoiceId: string }>;
  };
  clients: Array<{ id: string; name: string }>;
  services: Array<{ id: string; description: string }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(candidate.clientId ?? "");
  const [serviceId, setServiceId] = useState(candidate.serviceId ?? "");
  const [description, setDescription] = useState(candidate.editedDescription ?? candidate.calendarEvent.title ?? "");
  const [quantity, setQuantity] = useState(
    candidate.editedQuantity ? candidate.editedQuantity.toString() : "1",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canReview = candidate.reviewState === "PENDING" || candidate.reviewState === "EDITED";

  return (
    <article className="card stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0 }}>{candidate.calendarEvent.title ?? "Untitled event"}</h3>
          <p>
            {formatDate(candidate.calendarEvent.startAt)} — {candidate.calendarEvent.selectedCalendar.displayName ?? "Calendar"}
          </p>
        </div>
        <span className="badge">{formatStatus(candidate.reviewState)}</span>
      </div>

      <div className="card" style={{ background: "#fbfcfd" }}>
        <div><strong>Evidence:</strong> {candidate.calendarEvent.description ?? "No description"}</div>
        <div><strong>Match status:</strong> {candidate.matchConfidence ? formatStatus(candidate.matchConfidence) : "Unmatched"}</div>
        {candidate.lineItems[0] ? (
          <div><strong>Invoice draft:</strong> Linked to draft invoice</div>
        ) : null}
      </div>

      {canReview ? (
        <>
          <div className="field">
            <label htmlFor={`client-${candidate.id}`}>Client</label>
            <select
              id={`client-${candidate.id}`}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`service-${candidate.id}`}>Service</label>
            <select
              id={`service-${candidate.id}`}
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Select service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.description}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`description-${candidate.id}`}>Description</label>
            <input
              id={`description-${candidate.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`quantity-${candidate.id}`}>Quantity</label>
            <input
              id={`quantity-${candidate.id}`}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await editWorkCandidateAction(candidate.id, {
                    clientId: clientId || undefined,
                    serviceId: serviceId || undefined,
                    editedDescription: description || undefined,
                    editedQuantity: quantity || undefined,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {pending ? "Saving..." : "Save review"}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const saveResult = await editWorkCandidateAction(candidate.id, {
                    clientId: clientId || undefined,
                    serviceId: serviceId || undefined,
                    editedDescription: description || undefined,
                    editedQuantity: quantity || undefined,
                  });
                  if (!saveResult.ok) {
                    setError(saveResult.error);
                    return;
                  }
                  const draftResult = await createInvoiceDraftFromWorkCandidateAction(candidate.id);
                  if (draftResult && !draftResult.ok) {
                    setError(draftResult.error);
                  }
                });
              }}
            >
              {pending ? "Creating..." : "Create invoice draft"}
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await rejectWorkCandidateAction(candidate.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              Reject
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
