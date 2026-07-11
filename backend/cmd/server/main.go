package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/analytics-engine/backend/internal/broker"
	"github.com/analytics-engine/backend/internal/config"
	httphandler "github.com/analytics-engine/backend/internal/handler"
	"github.com/analytics-engine/backend/internal/logging"
	"github.com/analytics-engine/backend/internal/middleware"
	"github.com/analytics-engine/backend/internal/storage"
	"github.com/analytics-engine/backend/internal/worker"
)

func main() {
	cfg := config.Load()
	logger := logging.Setup(logging.Options{
		Level:   cfg.LogLevel,
		Format:  cfg.LogFormat,
		Service: cfg.ServiceName,
	})

	if err := run(cfg, logger); err != nil {
		logger.Error("server exited with error", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(cfg config.Config, logger *slog.Logger) error {
	logger.Info("starting server", slog.String("config", cfg.String()))

	store, err := storage.NewSQLiteDatabase(cfg.SQLitePath)
	if err != nil {
		return err
	}
	defer func() {
		if err := store.Close(); err != nil {
			logger.Error("sqlite close failed", slog.Any("error", err))
		}
	}()
	logger.Info("sqlite ready", slog.String("path", cfg.SQLitePath))

	bus := broker.New()
	pool := worker.NewPool(store, cfg.Workers, bus)
	pool.Start()

	ingestion := httphandler.NewIngestionHandler(pool)
	stream := httphandler.NewStreamHandler(bus)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/events", ingestion.HandleEvents)
	mux.HandleFunc("/api/v1/stream", stream.HandleStream)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// CORS must wrap outermost so Access-Control-* headers are always present,
	// including on early SSE responses and OPTIONS preflights.
	root := middleware.CORS(middleware.RequestLogger(logger)(mux))

	server := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      root,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  0,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server listening", slog.String("addr", cfg.HTTPAddr))
		errCh <- server.ListenAndServe()
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case sig := <-sigCh:
		logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("http shutdown failed", slog.Any("error", err))
	}

	pool.Shutdown()
	logger.Info("shutdown complete")
	return nil
}
