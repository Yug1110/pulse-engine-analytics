package logging

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type ctxKey struct{}

// Options configures the process-wide logger.
type Options struct {
	Level   string // debug, info, warn, error
	Format  string // json | text
	Service string
	Writer  io.Writer
}

// Setup installs a structured slog default logger and returns it.
func Setup(opts Options) *slog.Logger {
	if opts.Writer == nil {
		opts.Writer = os.Stdout
	}
	if opts.Service == "" {
		opts.Service = "analytics-engine"
	}

	level := parseLevel(opts.Level)
	handlerOpts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	switch strings.ToLower(opts.Format) {
	case "text":
		handler = slog.NewTextHandler(opts.Writer, handlerOpts)
	default:
		handler = slog.NewJSONHandler(opts.Writer, handlerOpts)
	}

	logger := slog.New(handler).With(
		slog.String("service", opts.Service),
	)
	slog.SetDefault(logger)
	return logger
}

// WithContext stores logger in ctx for request-scoped logging.
func WithContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, logger)
}

// FromContext returns the request logger, or slog.Default().
func FromContext(ctx context.Context) *slog.Logger {
	if v, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok && v != nil {
		return v
	}
	return slog.Default()
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
