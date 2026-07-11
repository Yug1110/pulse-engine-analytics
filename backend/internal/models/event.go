package models

import "time"

// Event represents an analytics event accepted by the ingestion API.
type Event struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}
