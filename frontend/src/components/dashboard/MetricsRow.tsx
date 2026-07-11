import { MetricCard } from "@/components/ui/MetricCard";
import { VELOCITY_WINDOW_MS } from "@/lib/constants";

interface MetricsRowProps {
  totalProcessed: number;
  velocity: number;
  mostCommon: { type: string; count: number };
}

export function MetricsRow({
  totalProcessed,
  velocity,
  mostCommon,
}: MetricsRowProps) {
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-3">
      <MetricCard
        label="Total Events Processed"
        value={totalProcessed.toLocaleString()}
        hint="Session cumulative · all SSE events received"
      />
      <MetricCard
        label="Events / Sec"
        value={velocity.toFixed(2)}
        hint={`Rolling ${VELOCITY_WINDOW_MS / 1000}s velocity`}
      />
      <MetricCard
        label="Most Common Event Type"
        value={mostCommon.type}
        hint={
          mostCommon.count > 0
            ? `${mostCommon.count} in live buffer`
            : "Waiting for stream"
        }
      />
    </section>
  );
}
