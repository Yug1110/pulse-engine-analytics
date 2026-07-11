package storage

import (
	"context"

	"github.com/analytics-engine/backend/internal/models"
)

// Strategy defines the database storage contract (Strategy Pattern).
// Concrete implementations (Mock, Postgres, ClickHouse, etc.) can be swapped
// without changing the worker pool or HTTP layer.
type Strategy interface {
	// InsertBatch persists a batch of events. Implementations must be safe
	// for concurrent use if multiple workers share the same strategy.
	InsertBatch(ctx context.Context, events []models.Event) error

	// Close releases any resources held by the storage backend.
	Close() error
}
