package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/analytics-engine/backend/internal/broker"
	"github.com/analytics-engine/backend/internal/logging"
	"github.com/analytics-engine/backend/internal/middleware"
	"github.com/analytics-engine/backend/internal/models"
)

// StreamHandler serves Server-Sent Events to connected clients.
type StreamHandler struct {
	broker *broker.Broker
}

// NewStreamHandler wires a StreamHandler to the given Broker.
func NewStreamHandler(b *broker.Broker) *StreamHandler {
	return &StreamHandler{broker: b}
}

// HandleStream serves GET /api/v1/stream as an SSE feed.
func (h *StreamHandler) HandleStream(w http.ResponseWriter, r *http.Request) {
	logger := logging.FromContext(r.Context()).With(slog.String("component", "sse"))

	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		logger.Error("streaming unsupported by response writer")
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Ensure CORS headers are present before the first SSE flush.
	middleware.ApplyCORSHeaders(w, r)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch := h.broker.Subscribe()
	logger.Info("sse client connected", slog.Int("subscribers", h.broker.SubscriberCount()))
	defer func() {
		h.broker.Unsubscribe(ch)
		logger.Info("sse client disconnected", slog.Int("subscribers", h.broker.SubscriberCount()))
	}()

	ping := time.NewTicker(15 * time.Second)
	defer ping.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return

		case <-ping.C:
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				logger.Debug("sse ping write failed", slog.Any("error", err))
				return
			}
			flusher.Flush()

		case events, ok := <-ch:
			if !ok {
				return
			}
			if err := writeSSEBatch(w, flusher, events); err != nil {
				logger.Warn("sse client write error",
					slog.Int("batch_size", len(events)),
					slog.Any("error", err),
				)
				return
			}
			logger.Debug("sse batch delivered", slog.Int("batch_size", len(events)))
		}
	}
}

func writeSSEBatch(w http.ResponseWriter, flusher http.Flusher, events []models.Event) error {
	for _, e := range events {
		data, err := json.Marshal(e)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "id: %s\nevent: analytics\ndata: %s\n\n", e.EventID, data); err != nil {
			return err
		}
	}
	flusher.Flush()
	return nil
}
