package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/analytics-engine/backend/internal/logging"
)

const requestIDHeader = "X-Request-ID"

// RequestLogger adds a request ID, request-scoped logger, and access log.
func RequestLogger(base *slog.Logger) func(http.Handler) http.Handler {
	if base == nil {
		base = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			reqID := r.Header.Get(requestIDHeader)
			if reqID == "" {
				reqID = newRequestID()
			}
			w.Header().Set(requestIDHeader, reqID)

			logger := base.With(
				slog.String("request_id", reqID),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.String("remote_addr", clientIP(r)),
			)
			ctx := logging.WithContext(r.Context(), logger)
			r = r.WithContext(ctx)

			ww := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(ww, r)

			attrs := []any{
				slog.Int("status", ww.status),
				slog.Int64("bytes", ww.bytes),
				slog.Duration("duration", time.Since(start)),
			}
			if ua := r.UserAgent(); ua != "" {
				attrs = append(attrs, slog.String("user_agent", ua))
			}

			msg := "http_request"
			switch {
			case ww.status >= 500:
				logger.Error(msg, attrs...)
			case ww.status >= 400:
				logger.Warn(msg, attrs...)
			case r.URL.Path == "/healthz":
				logger.Debug(msg, attrs...)
			default:
				logger.Info(msg, attrs...)
			}
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytes += int64(n)
	return n, err
}

// Flush preserves http.Flusher for SSE endpoints.
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func newRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(b)
}
