import type { StreamedEvent } from "@/hooks/useEventStream";
import { Panel } from "@/components/ui/Panel";
import { EventRow } from "@/components/dashboard/EventRow";

interface EventFeedProps {
  events: StreamedEvent[];
  freshIds: Set<string>;
}

export function EventFeed({ events, freshIds }: EventFeedProps) {
  return (
    <Panel className="flex h-[560px] flex-col overflow-hidden lg:col-span-3">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Live event feed
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Newest first · capped at 50 rows
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {events.length} buffered
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,rgba(10,12,18,0.9),rgba(14,16,22,0.95))]">
        {events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-mono text-sm text-muted">
              awaiting events<span className="animate-pulse">_</span>
            </p>
            <p className="max-w-sm text-xs text-muted/80">
              POST to <code className="text-accent/90">/api/v1/events</code> and
              flushes will appear here over SSE.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <EventRow
              key={event.uid}
              event={event}
              isNew={freshIds.has(event.uid)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
