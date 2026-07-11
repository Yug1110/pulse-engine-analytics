package middleware

import (
	"net/http"
)

// CORS enables browser access from the Next.js frontend (and other origins)
// so EventSource / fetch can reach the Go API on a different port.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ApplyCORSHeaders(w, r)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ApplyCORSHeaders writes the CORS response headers for the request origin.
func ApplyCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}

	h := w.Header()
	h.Set("Access-Control-Allow-Origin", origin)
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
	h.Set("Access-Control-Expose-Headers", "X-Request-ID")
	h.Add("Vary", "Origin")

	// Only pair credentials with a concrete origin (never with "*").
	if origin != "*" {
		h.Set("Access-Control-Allow-Credentials", "true")
	}
}
