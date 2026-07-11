import {
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react";
import type { StreamedEvent } from "@/hooks/useEventStream";
import {
  CHART_BUCKET_MS,
  CHART_WINDOW_MS,
  FRESH_HIGHLIGHT_MS,
  VELOCITY_WINDOW_MS,
} from "@/lib/constants";
import { formatBucketLabel } from "@/lib/format";

export interface VolumeBucket {
  label: string;
  count: number;
}

export interface EventMetrics {
  velocity: number;
  mostCommon: { type: string; count: number };
  chartBuckets: VolumeBucket[];
  freshIds: Set<string>;
}

/**
 * Derives dashboard metrics from the live SSE buffer + arrival timestamps
 * recorded by useEventStream (so totals/velocity survive the 50-row UI cap).
 */
export function useEventMetrics(
  events: StreamedEvent[],
  arrivalsRef: MutableRefObject<number[]>,
): EventMetrics {
  const [velocity, setVelocity] = useState(0);
  const [chartBuckets, setChartBuckets] = useState<VolumeBucket[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [seenUids] = useState(() => new Set<string>());

  useEffect(() => {
    const newlySeen: string[] = [];
    for (const event of events) {
      if (!seenUids.has(event.uid)) {
        seenUids.add(event.uid);
        newlySeen.push(event.uid);
      }
    }

    if (newlySeen.length === 0) {
      return;
    }

    setFreshIds(new Set(newlySeen));
    const timeout = window.setTimeout(() => {
      setFreshIds(new Set());
    }, FRESH_HIGHLIGHT_MS);

    return () => window.clearTimeout(timeout);
  }, [events, seenUids]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      arrivalsRef.current = arrivalsRef.current.filter(
        (ts) => now - ts <= Math.max(VELOCITY_WINDOW_MS, CHART_WINDOW_MS),
      );

      const recent = arrivalsRef.current.filter(
        (ts) => now - ts <= VELOCITY_WINDOW_MS,
      );
      setVelocity(recent.length / (VELOCITY_WINDOW_MS / 1000));

      const bucketCount = Math.floor(CHART_WINDOW_MS / CHART_BUCKET_MS);
      const nextBuckets: VolumeBucket[] = [];
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        const start = now - (i + 1) * CHART_BUCKET_MS;
        const end = now - i * CHART_BUCKET_MS;
        const count = arrivalsRef.current.filter(
          (ts) => ts >= start && ts < end,
        ).length;
        nextBuckets.push({
          label: formatBucketLabel(end),
          count,
        });
      }
      setChartBuckets(nextBuckets);
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [arrivalsRef]);

  const mostCommon = useMemo(() => {
    if (events.length === 0) {
      return { type: "—", count: 0 };
    }

    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.event_type, (counts.get(event.event_type) ?? 0) + 1);
    }

    let bestType = "—";
    let bestCount = 0;
    for (const [type, count] of counts) {
      if (count > bestCount) {
        bestType = type;
        bestCount = count;
      }
    }

    return { type: bestType, count: bestCount };
  }, [events]);

  return {
    velocity,
    mostCommon,
    chartBuckets,
    freshIds,
  };
}
