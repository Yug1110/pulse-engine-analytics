import type { ConnectionStatus } from "@/hooks/useEventStream";

const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    wrap: "border-accent/40 bg-accent/10 text-accent",
    dot: "bg-accent animate-pulse-dot",
  },
  connecting: {
    label: "Connecting",
    wrap: "border-warn/40 bg-warn/10 text-warn",
    dot: "bg-warn animate-pulse-dot",
  },
  disconnected: {
    label: "Disconnected",
    wrap: "border-danger/40 bg-danger/10 text-danger",
    dot: "bg-danger",
  },
} as const satisfies Record<
  ConnectionStatus,
  { label: string; wrap: string; dot: string }
>;

interface StatusBadgeProps {
  status: ConnectionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium tracking-wide ${config.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
