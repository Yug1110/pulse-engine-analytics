"use client";

import { useState } from "react";

interface JsonNodeProps {
  label?: string;
  value: unknown;
  depth?: number;
  defaultOpen?: boolean;
}

export function JsonNode({
  label,
  value,
  depth = 0,
  defaultOpen = false,
}: JsonNodeProps) {
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  const isObject =
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  if (!isExpandable) {
    const rendered =
      typeof value === "string"
        ? `"${value}"`
        : value === null
          ? "null"
          : String(value);
    const tone =
      typeof value === "string"
        ? "text-amber-200"
        : typeof value === "number"
          ? "text-sky-300"
          : typeof value === "boolean"
            ? "text-teal-300"
            : "text-muted";

    return (
      <div className="font-mono text-[12px] leading-5">
        {label !== undefined && (
          <span className="text-zinc-400">{label}: </span>
        )}
        <span className={tone}>{rendered}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="font-mono text-[12px] leading-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex items-center gap-1 rounded px-0.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="text-muted transition-transform duration-200 group-hover:text-foreground">
          {open ? "▾" : "▸"}
        </span>
        {label !== undefined && (
          <span className="text-zinc-400">{label}: </span>
        )}
        <span className="text-muted">
          {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
        </span>
      </button>
      {open && (
        <div className="ml-3 border-l border-border/80 pl-3 pt-0.5">
          {entries.length === 0 ? (
            <span className="text-muted">{isArray ? "[]" : "{}"}</span>
          ) : (
            entries.map(([key, child]) => (
              <JsonNode
                key={`${depth}-${key}`}
                label={key}
                value={child}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
