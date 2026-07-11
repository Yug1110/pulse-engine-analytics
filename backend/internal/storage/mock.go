package storage

import (
	"context"
	"fmt"
	"sync"

	"github.com/analytics-engine/backend/internal/models"
)

// MockDatabase is a Strategy implementation that logs batch inserts to stdout.
// Useful for local development and load testing without a real database.
type MockDatabase struct {
	mu         sync.Mutex
	totalFlushed int64
}

// NewMockDatabase constructs a MockDatabase storage strategy.
func NewMockDatabase() *MockDatabase {
	return &MockDatabase{}
}

// InsertBatch prints the batched insert size to the console.
func (m *MockDatabase) InsertBatch(_ context.Context, events []models.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	n := len(events)
	m.totalFlushed += int64(n)
	fmt.Printf("[MockDatabase] flushed batch size=%d (total_flushed=%d)\n", n, m.totalFlushed)
	return nil
}

// Close is a no-op for the mock implementation.
func (m *MockDatabase) Close() error {
	return nil
}

// TotalFlushed returns the cumulative number of events flushed (for tests).
func (m *MockDatabase) TotalFlushed() int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.totalFlushed
}
