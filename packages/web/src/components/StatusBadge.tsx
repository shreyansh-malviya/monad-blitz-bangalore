const STATUS_CLASS: Record<string, string> = {
  CREATED: "s-created",
  ROUTING: "s-routing",
  COLLECTING: "s-collecting",
  SCORING: "s-scoring",
  ESCALATING: "s-escalating",
  SETTLED: "s-settled",
  FAILED: "s-failed",
};

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  ROUTING: "Routing",
  COLLECTING: "Collecting",
  SCORING: "Scoring",
  ESCALATING: "Escalating",
  SETTLED: "Settled",
  FAILED: "Failed",
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: Props) {
  const key = status.toUpperCase();
  const cls = STATUS_CLASS[key] ?? "s-created";
  const label = STATUS_LABEL[key] ?? status;
  return (
    <span
      className={`badge ${cls}`}
      style={size === "sm" ? { fontSize: 10, padding: "1px 6px" } : {}}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
