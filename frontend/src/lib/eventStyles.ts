const TYPE_STYLES = [
  "bg-teal-500/15 text-teal-300 border-teal-500/35",
  "bg-sky-500/15 text-sky-300 border-sky-500/35",
  "bg-amber-500/15 text-amber-300 border-amber-500/35",
  "bg-rose-500/15 text-rose-300 border-rose-500/35",
  "bg-lime-500/15 text-lime-300 border-lime-500/35",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/35",
  "bg-orange-500/15 text-orange-300 border-orange-500/35",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
] as const;

function hashType(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function typeBadgeClass(eventType: string): string {
  return TYPE_STYLES[hashType(eventType) % TYPE_STYLES.length];
}
