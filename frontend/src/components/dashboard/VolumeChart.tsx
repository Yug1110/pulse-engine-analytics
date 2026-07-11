"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { VolumeBucket } from "@/hooks/useEventMetrics";
import { CHART_BUCKET_MS } from "@/lib/constants";
import { Panel } from "@/components/ui/Panel";

interface VolumeChartProps {
  buckets: VolumeBucket[];
}

interface HoverState {
  index: number;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function niceMax(value: number): number {
  if (value <= 1) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const scaled = value / base;
  const nice =
    scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * base;
}

export function VolumeChart({ buckets }: VolumeChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const rawMax = Math.max(1, ...buckets.map((b) => b.count));
  const max = niceMax(rawMax);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  const width = 360;
  const height = 200;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 8;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = buckets.length > 0 ? innerW / buckets.length : innerW;

  const yTicks = useMemo(() => {
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      ratio,
      value: Math.round(max * ratio),
      y: padTop + innerH * (1 - ratio),
    }));
    // Deduplicate when max is small (e.g. max=1 → 0 and 1 only once each).
    const seen = new Set<number>();
    return ticks.filter((t) => {
      if (seen.has(t.value)) return false;
      seen.add(t.value);
      return true;
    });
  }, [max, innerH]);

  const points = buckets.map((bucket, index) => {
    const x = padLeft + index * step + step / 2;
    const y = padTop + innerH - (bucket.count / max) * innerH;
    return { x, y, bucket, index };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    points.length === 0
      ? ""
      : `M ${points[0].x} ${padTop + innerH} ${points
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ")} L ${points[points.length - 1].x} ${padTop + innerH} Z`;

  const active = hover ? points[hover.index] : null;

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    if (buckets.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const svgX = xRatio * width;
    const idx = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((svgX - padLeft) / step)),
    );
    setHover({ index: idx });
  };

  return (
    <Panel className="relative h-[560px] p-5 lg:col-span-2">
      <div className="flex h-full flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Event volume
            </h2>
            <p className="mt-1 text-xs text-muted">
              Last 60s · {CHART_BUCKET_MS / 1000}s buckets
            </p>
          </div>
          <p className="font-mono text-sm tabular-nums text-accent">{total}</p>
        </div>

        <div className="relative mt-6 flex flex-1 flex-col justify-end">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-48 w-full cursor-crosshair"
            role="img"
            aria-label="Event volume over the last sixty seconds"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3ddc97" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y-axis grid + labels */}
            {yTicks.map((tick) => (
              <g key={`y-${tick.value}-${tick.ratio}`}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#232836"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-muted"
                  style={{ fontSize: 9, fontFamily: "var(--font-jetbrains), monospace" }}
                >
                  {tick.value}
                </text>
              </g>
            ))}

            {/* Y-axis line */}
            <line
              x1={padLeft}
              x2={padLeft}
              y1={padTop}
              y2={padTop + innerH}
              stroke="#2a3142"
              strokeWidth="1"
            />

            {/* X-axis line */}
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={padTop + innerH}
              y2={padTop + innerH}
              stroke="#2a3142"
              strokeWidth="1"
            />

            {areaPath && (
              <path d={areaPath} fill="url(#volumeFill)" opacity="0.9" />
            )}

            {total > 0 && (
              <polyline
                fill="none"
                stroke="#3ddc97"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polyline}
                opacity="0.95"
              />
            )}

            {/* Invisible hit targets per bucket */}
            {points.map((point) => (
              <rect
                key={`hit-${point.index}`}
                x={padLeft + point.index * step}
                y={padTop}
                width={step}
                height={innerH}
                fill="transparent"
              />
            ))}

            {active && (
              <g>
                <line
                  x1={active.x}
                  x2={active.x}
                  y1={padTop}
                  y2={padTop + innerH}
                  stroke="#3ddc97"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={active.x}
                  cy={active.y}
                  r="4"
                  fill="#0e1016"
                  stroke="#3ddc97"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {active && hover && (
            <div
              className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 -translate-y-[120%] rounded-lg border border-border bg-surface-raised px-3 py-2 shadow-lg shadow-black/40"
              style={{
                left: `${((active.x / width) * 100).toFixed(2)}%`,
                top: `${((active.y / height) * 100).toFixed(2)}%`,
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {active.bucket.label}
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                <span className="text-accent">{active.bucket.count}</span>
                <span className="text-muted"> events</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                {CHART_BUCKET_MS / 1000}s bucket ·{" "}
                {total > 0
                  ? `${((active.bucket.count / total) * 100).toFixed(1)}% of window`
                  : "0% of window"}
              </p>
            </div>
          )}

          <div
            className="mt-2 grid font-mono text-[10px] text-muted"
            style={{
              paddingLeft: `${(padLeft / width) * 100}%`,
              paddingRight: `${(padRight / width) * 100}%`,
            }}
          >
            <div className="flex justify-between">
              <span>-60s</span>
              <span>-30s</span>
              <span>now</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <StatChip label="Peak" value={String(rawMax)} />
          <StatChip
            label="Avg / bucket"
            value={(total / Math.max(buckets.length, 1)).toFixed(1)}
          />
          <StatChip label="Buckets" value={String(buckets.length)} />
        </div>
      </div>
    </Panel>
  );
}
