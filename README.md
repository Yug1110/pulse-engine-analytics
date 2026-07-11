# PulseEngine: High-Throughput Analytics Ingestion System

A production-grade template showcasing a high-performance event tracking architecture. Built to demonstrate handling high-volume data streaming with minimal latency.

## 🚀 Architecture Highlights

*   **Go Backend Ingestion:** Exposes a high-throughput endpoint (`POST /api/v1/events`) that drops payloads into a buffered Go channel (size 10,000) immediately, ensuring sub-10ms HTTP response times.
*   **Worker Pool Pattern:** Uses 5 concurrent background goroutines to read from the channel, batching events in memory to perform optimized bulk transaction writes to SQLite every 2 seconds or 100 items.
*   **Pub/Sub Event Broker:** A thread-safe Go broker routes successfully persisted event batches directly to a Server-Sent Events (SSE) handler.
*   **Next.js Streaming Frontend:** Implements a custom React hook managing native `EventSource` connections, parsing incoming live streams dynamically, and throttling UI rendering to a 50-item rolling buffer.

## 🛠️ Tech Stack
*   **Backend:** Go (Golang), SQLite, Event Streaming (SSE), Goroutines/Channels
*   **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Recharts