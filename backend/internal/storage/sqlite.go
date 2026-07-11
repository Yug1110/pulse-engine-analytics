package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/analytics-engine/backend/internal/models"
	_ "modernc.org/sqlite"
)

// SQLiteDatabase is a Strategy implementation backed by SQLite via database/sql.
type SQLiteDatabase struct {
	db  *sql.DB
	log *slog.Logger
}

// NewSQLiteDatabase opens (or creates) the SQLite database at path, applies
// pragmas suited for concurrent writers, and ensures the events schema exists.
func NewSQLiteDatabase(path string) (*SQLiteDatabase, error) {
	if path == "" {
		return nil, fmt.Errorf("sqlite path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create sqlite directory: %w", err)
	}

	log := slog.Default().With(
		slog.String("component", "sqlite"),
		slog.String("path", path),
	)

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// Allow the worker pool to share one connection pool safely.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	if _, err := db.Exec(`PRAGMA journal_mode=WAL;`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("enable WAL: %w", err)
	}
	if _, err := db.Exec(`PRAGMA busy_timeout=5000;`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("set busy_timeout: %w", err)
	}

	s := &SQLiteDatabase{db: db, log: log}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	log.Info("database opened")
	return s, nil
}

func (s *SQLiteDatabase) migrate() error {
	const ddl = `
CREATE TABLE IF NOT EXISTS events (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	event_id   TEXT    NOT NULL,
	event_type TEXT    NOT NULL,
	payload    TEXT    NOT NULL,
	timestamp  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`
	if _, err := s.db.Exec(ddl); err != nil {
		return fmt.Errorf("migrate events schema: %w", err)
	}
	s.log.Debug("schema migrated")
	return nil
}

// InsertBatch writes all events in a single transaction.
func (s *SQLiteDatabase) InsertBatch(ctx context.Context, events []models.Event) error {
	if len(events) == 0 {
		return nil
	}

	start := time.Now()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PrepareContext(ctx, `
INSERT INTO events (event_id, event_type, payload, timestamp)
VALUES (?, ?, ?, ?)
`)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	for _, e := range events {
		payload, err := json.Marshal(e.Payload)
		if err != nil {
			return fmt.Errorf("marshal payload for event_id=%s: %w", e.EventID, err)
		}
		ts := e.Timestamp
		if ts.IsZero() {
			ts = time.Now().UTC()
		}
		if _, err := stmt.ExecContext(ctx, e.EventID, e.EventType, string(payload), ts.UTC().Format(time.RFC3339Nano)); err != nil {
			return fmt.Errorf("insert event_id=%s: %w", e.EventID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	s.log.Debug("batch inserted",
		slog.Int("batch_size", len(events)),
		slog.Duration("duration", time.Since(start)),
	)
	return nil
}

// Close closes the underlying database connection.
func (s *SQLiteDatabase) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}
