import type { ConnectionStatus } from "@/hooks/useEventStream";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface DashboardHeaderProps {
  connectionStatus: ConnectionStatus;
  error: string | null;
}

export function DashboardHeader({
  connectionStatus,
  error,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          Live ingestion
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          PulseEngine Analytics
        </h1>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <StatusBadge status={connectionStatus} />
        {error && (
          <p className="max-w-md text-right text-xs text-danger/90">{error}</p>
        )}
      </div>
    </header>
  );
}
