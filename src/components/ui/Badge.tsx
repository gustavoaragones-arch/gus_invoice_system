export function Badge({ status }: { status: "DRAFT" | "FINALIZED" | "VOID" | string }) {
  const className =
    status === "DRAFT"
      ? "badge badge-draft"
      : status === "FINALIZED"
        ? "badge badge-finalized"
        : status === "VOID"
          ? "badge badge-void"
          : "badge";
  return <span className={className}>{status === "DRAFT" ? "Draft" : status === "FINALIZED" ? "Finalized" : status === "VOID" ? "Void" : status}</span>;
}
