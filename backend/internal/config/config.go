package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/analytics-engine/backend/internal/worker"
)

// Config holds process configuration loaded from the environment.
type Config struct {
	HTTPAddr    string
	SQLitePath  string
	LogLevel    string
	LogFormat   string
	ServiceName string
	Workers     worker.Config
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	return Config{
		HTTPAddr:    envOr("HTTP_ADDR", ":8080"),
		SQLitePath:  envOr("SQLITE_PATH", "./data/events.db"),
		LogLevel:    envOr("LOG_LEVEL", "info"),
		LogFormat:   envOr("LOG_FORMAT", "json"),
		ServiceName: envOr("SERVICE_NAME", "analytics-engine"),
		Workers: worker.Config{
			NumWorkers: envInt("WORKER_COUNT", worker.DefaultWorkers),
			BufferSize: envInt("WORKER_BUFFER_SIZE", worker.DefaultBufferSize),
			BatchSize:  envInt("WORKER_BATCH_SIZE", worker.DefaultBatchSize),
			FlushEvery: envDuration("WORKER_FLUSH_EVERY", worker.DefaultFlushEvery),
		},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

// String returns a redaction-safe summary for startup logs.
func (c Config) String() string {
	return fmt.Sprintf(
		"http_addr=%s sqlite_path=%s log_level=%s log_format=%s workers=%d buffer=%d batch=%d flush_every=%s",
		c.HTTPAddr,
		c.SQLitePath,
		strings.ToLower(c.LogLevel),
		strings.ToLower(c.LogFormat),
		c.Workers.NumWorkers,
		c.Workers.BufferSize,
		c.Workers.BatchSize,
		c.Workers.FlushEvery,
	)
}
