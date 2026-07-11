export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const base = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${base}.${ms}`;
}

export function formatBucketLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
