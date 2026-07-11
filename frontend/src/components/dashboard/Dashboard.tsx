"use client";

import { useEventStream } from "@/hooks/useEventStream";
import { useEventMetrics } from "@/hooks/useEventMetrics";
import { LIVE_BUFFER_SIZE } from "@/lib/constants";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricsRow } from "@/components/dashboard/MetricsRow";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

export function Dashboard() {
  const { events, totalReceived, arrivalsRef, connectionStatus, error } =
    useEventStream({
      maxEvents: LIVE_BUFFER_SIZE,
    });
  const { velocity, mostCommon, chartBuckets, freshIds } = useEventMetrics(
    events,
    arrivalsRef,
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(61,220,151,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(56,189,248,0.05),_transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <DashboardHeader connectionStatus={connectionStatus} error={error} />
        <MetricsRow
          totalProcessed={totalReceived}
          velocity={velocity}
          mostCommon={mostCommon}
        />
        <section className="mt-6 grid min-h-0 flex-1 gap-4 lg:grid-cols-5">
          <EventFeed events={events} freshIds={freshIds} />
          <VolumeChart buckets={chartBuckets} />
        </section>
      </div>
    </div>
  );
}
