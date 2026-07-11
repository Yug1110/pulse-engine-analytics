"use client";

import { useState } from "react";
import type { StreamedEvent } from "@/hooks/useEventStream";
import { JsonNode } from "@/components/ui/JsonTree";
import { typeBadgeClass } from "@/lib/eventStyles";
import { formatClock } from "@/lib/format";

interface EventRowProps {
  event: StreamedEvent;
  isNew: boolean;
}

export function EventRow({ event, isNew }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={`border-b border-border/70 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.02] ${
        isNew ? "animate-row-enter bg-accent/[0.04]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <time className="font-mono text-[11px] tabular-nums text-muted">
          {formatClock(event.timestamp)}
        </time>
        <span
          className={`rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide ${typeBadgeClass(event.event_type)}`}
        >
          {event.event_type}
        </span>
        <span className="truncate font-mono text-[11px] text-muted/80">
          {event.event_id}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-auto rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          {expanded ? "Hide payload" : "Inspect payload"}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background/80 p-3">
          <JsonNode value={event.payload} defaultOpen />
        </div>
      )}
    </article>
  );
}
