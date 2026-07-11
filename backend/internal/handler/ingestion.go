package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/analytics-engine/backend/internal/logging"
	"github.com/analytics-engine/backend/internal/models"
	"github.com/analytics-engine/backend/internal/worker"
)

// IngestionHandler accepts JSON event payloads and enqueues them onto the
// worker pool's buffered channel for asynchronous persistence.
type IngestionHandler struct {
	pool *worker.Pool
}

// NewIngestionHandler wires an IngestionHandler to the given worker Pool.
func NewIngestionHandler(pool *worker.Pool) *IngestionHandler {
	return &IngestionHandler{pool: pool}
}

type eventRequest struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}

// HandleEvents serves POST /api/v1/events.
func (h *IngestionHandler) HandleEvents(w http.ResponseWriter, r *http.Request) {
	logger := logging.FromContext(r.Context()).With(slog.String("component", "ingestion"))

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	defer r.Body.Close()

	var req eventRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		logger.Warn("invalid json payload", slog.Any("error", err))
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid JSON payload: " + err.Error(),
		})
		return
	}

	if req.EventID == "" || req.EventType == "" {
		logger.Warn("missing required fields",
			slog.String("event_id", req.EventID),
			slog.String("event_type", req.EventType),
		)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "event_id and event_type are required",
		})
		return
	}

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now().UTC()
	}
	if req.Payload == nil {
		req.Payload = map[string]interface{}{}
	}

	event := models.Event{
		EventID:   req.EventID,
		EventType: req.EventType,
		Payload:   req.Payload,
		Timestamp: req.Timestamp,
	}

	if !h.pool.Submit(event) {
		logger.Warn("ingestion buffer full",
			slog.String("event_id", event.EventID),
			slog.String("event_type", event.EventType),
		)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "ingestion buffer full, retry later",
		})
		return
	}

	logger.Info("event accepted",
		slog.String("event_id", event.EventID),
		slog.String("event_type", event.EventType),
	)
	writeJSON(w, http.StatusAccepted, map[string]string{
		"status":   "accepted",
		"event_id": event.EventID,
	})
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
