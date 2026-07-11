interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised/80 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors duration-300 hover:border-border/80">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </div>
  );
}
