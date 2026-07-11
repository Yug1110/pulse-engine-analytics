"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

/** Mirrors the Go backend `models.Event` JSON shape. */
export interface AnalyticsEvent {
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Client-enriched event with a unique row id (event_id alone is not unique). */
export interface StreamedEvent extends AnalyticsEvent {
  uid: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseEventStreamOptions {
  /** SSE endpoint. Defaults to the local Go ingestion stream. */
  url?: string;
  /** Max events retained in memory / DOM. Defaults to 50. */
  maxEvents?: number;
  /** Named SSE event from the Go handler (`event: analytics`). */
  eventName?: string;
  /** Base delay before the first reconnect attempt. */
  reconnectIntervalMs?: number;
  /** Cap for exponential backoff. */
  maxReconnectIntervalMs?: number;
  /** Set false to pause the stream without unmounting the consumer. */
  enabled?: boolean;
}

export interface UseEventStreamResult {
  events: StreamedEvent[];
  /** Session count of every event received over SSE (not capped at maxEvents). */
  totalReceived: number;
  /** Arrival timestamps for velocity / volume charts (mutated by the stream). */
  arrivalsRef: MutableRefObject<number[]>;
  connectionStatus: ConnectionStatus;
  error: string | null;
}

const DEFAULT_URL = "http://localhost:8080/api/v1/stream";
const DEFAULT_MAX_EVENTS = 50;
const DEFAULT_EVENT_NAME = "analytics";
const DEFAULT_RECONNECT_MS = 1_000;
const DEFAULT_MAX_RECONNECT_MS = 30_000;

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.event_id === "string" &&
    typeof v.event_type === "string" &&
    typeof v.timestamp === "string" &&
    (v.payload === undefined ||
      (typeof v.payload === "object" &&
        v.payload !== null &&
        !Array.isArray(v.payload)))
  );
}

function parseIncomingPayload(raw: string): AnalyticsEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed.filter(isAnalyticsEvent).map((e) => ({
      ...e,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    }));
  }

  if (isAnalyticsEvent(parsed)) {
    return [
      {
        ...parsed,
        payload: (parsed.payload ?? {}) as Record<string, unknown>,
      },
    ];
  }

  return [];
}

/**
 * Subscribes to the analytics SSE stream and keeps a bounded, newest-first
 * event buffer for live UI rendering.
 */
export function useEventStream(
  options: UseEventStreamOptions = {},
): UseEventStreamResult {
  const {
    url = DEFAULT_URL,
    maxEvents = DEFAULT_MAX_EVENTS,
    eventName = DEFAULT_EVENT_NAME,
    reconnectIntervalMs = DEFAULT_RECONNECT_MS,
    maxReconnectIntervalMs = DEFAULT_MAX_RECONNECT_MS,
    enabled = true,
  } = options;

  const [events, setEvents] = useState<StreamedEvent[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);
  const arrivalsRef = useRef<number[]>([]);
  const uidSeqRef = useRef(0);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  const prependEvents = useCallback(
    (incoming: AnalyticsEvent[]) => {
      if (incoming.length === 0) {
        return;
      }

      const now = Date.now();
      const stamped: StreamedEvent[] = incoming.map((event) => {
        uidSeqRef.current += 1;
        arrivalsRef.current.push(now);
        return {
          ...event,
          uid: `${event.event_id}-${now}-${uidSeqRef.current}`,
        };
      });
      setTotalReceived((prev) => prev + stamped.length);

      setEvents((prev) => {
        const next = [...stamped, ...prev];
        return next.length > maxEvents ? next.slice(0, maxEvents) : next;
      });
    },
    [maxEvents],
  );

  useEffect(() => {
    disposedRef.current = false;

    if (!enabled) {
      clearReconnectTimer();
      closeSource();
      setConnectionStatus("disconnected");
      return;
    }

    const scheduleReconnect = () => {
      if (disposedRef.current) {
        return;
      }

      clearReconnectTimer();
      const attempt = attemptRef.current;
      const delay = Math.min(
        maxReconnectIntervalMs,
        reconnectIntervalMs * 2 ** attempt,
      );
      attemptRef.current = attempt + 1;

      setConnectionStatus("connecting");
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposedRef.current) {
        return;
      }

      clearReconnectTimer();
      closeSource();
      setConnectionStatus("connecting");

      const source = new EventSource(url);
      sourceRef.current = source;

      source.onopen = () => {
        if (disposedRef.current) {
          return;
        }
        attemptRef.current = 0;
        setConnectionStatus("connected");
        setError(null);
      };

      const handlePayload = (raw: string) => {
        if (disposedRef.current) {
          return;
        }
        prependEvents(parseIncomingPayload(raw));
      };

      source.addEventListener(eventName, ((event: MessageEvent<string>) => {
        handlePayload(event.data);
      }) as EventListener);

      source.onmessage = (event: MessageEvent<string>) => {
        handlePayload(event.data);
      };

      source.onerror = () => {
        if (disposedRef.current) {
          return;
        }

        closeSource();
        setConnectionStatus("disconnected");
        setError(
          `SSE connection lost (${url}). Reconnecting with exponential backoff…`,
        );
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposedRef.current = true;
      clearReconnectTimer();
      closeSource();
      setConnectionStatus("disconnected");
    };
  }, [
    url,
    enabled,
    eventName,
    reconnectIntervalMs,
    maxReconnectIntervalMs,
    prependEvents,
    clearReconnectTimer,
    closeSource,
  ]);

  return {
    events,
    totalReceived,
    arrivalsRef,
    connectionStatus,
    error,
  };
}
