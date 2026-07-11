package worker

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/analytics-engine/backend/internal/broker"
	"github.com/analytics-engine/backend/internal/models"
	"github.com/analytics-engine/backend/internal/storage"
)

const (
	DefaultWorkers    = 5
	DefaultBufferSize = 10_000
	DefaultBatchSize  = 100
	DefaultFlushEvery = 2 * time.Second
)

// Config controls worker pool behaviour.
type Config struct {
	NumWorkers int
	BufferSize int
	BatchSize  int
	FlushEvery time.Duration
}

// DefaultConfig returns production-oriented defaults.
func DefaultConfig() Config {
	return Config{
		NumWorkers: DefaultWorkers,
		BufferSize: DefaultBufferSize,
		BatchSize:  DefaultBatchSize,
		FlushEvery: DefaultFlushEvery,
	}
}

// Pool is a concurrent worker pool that drains events from a buffered channel,
// aggregates them in memory, and flushes via the configured storage Strategy
// when the batch size is reached or the flush interval elapses.
type Pool struct {
	cfg     Config
	store   storage.Strategy
	broker  *broker.Broker
	events  chan models.Event
	log     *slog.Logger
	wg      sync.WaitGroup
	started bool
}

// NewPool creates a Pool backed by the given storage Strategy.
// After a successful flush, events are published to broker (may be nil).
func NewPool(store storage.Strategy, cfg Config, b *broker.Broker) *Pool {
	if cfg.NumWorkers <= 0 {
		cfg.NumWorkers = DefaultWorkers
	}
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = DefaultBufferSize
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = DefaultBatchSize
	}
	if cfg.FlushEvery <= 0 {
		cfg.FlushEvery = DefaultFlushEvery
	}

	return &Pool{
		cfg:    cfg,
		store:  store,
		broker: b,
		events: make(chan models.Event, cfg.BufferSize),
		log:    slog.Default().With(slog.String("component", "worker")),
	}
}

// Events returns the buffered ingestion channel.
func (p *Pool) Events() chan<- models.Event {
	return p.events
}

// Start launches background worker goroutines. Call once before serving traffic.
func (p *Pool) Start() {
	if p.started {
		return
	}
	p.started = true

	for i := 0; i < p.cfg.NumWorkers; i++ {
		p.wg.Add(1)
		go p.runWorker(i)
	}
	p.log.Info("worker pool started",
		slog.Int("workers", p.cfg.NumWorkers),
		slog.Int("buffer", p.cfg.BufferSize),
		slog.Int("batch_size", p.cfg.BatchSize),
		slog.Duration("flush_every", p.cfg.FlushEvery),
	)
}

// Submit enqueues an event. Returns false if the buffer is full (backpressure).
func (p *Pool) Submit(event models.Event) bool {
	select {
	case p.events <- event:
		return true
	default:
		return false
	}
}

// Shutdown closes the event channel and waits for all workers to drain and exit.
func (p *Pool) Shutdown() {
	close(p.events)
	p.wg.Wait()
	p.log.Info("worker pool shut down")
}

func (p *Pool) runWorker(id int) {
	defer p.wg.Done()
	log := p.log.With(slog.Int("worker_id", id))
	log.Debug("worker started")

	batch := make([]models.Event, 0, p.cfg.BatchSize)
	ticker := time.NewTicker(p.cfg.FlushEvery)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		size := len(batch)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		start := time.Now()
		if err := p.store.InsertBatch(ctx, batch); err != nil {
			log.Error("flush failed",
				slog.Int("batch_size", size),
				slog.Duration("duration", time.Since(start)),
				slog.Any("error", err),
			)
		} else {
			log.Info("flush succeeded",
				slog.Int("batch_size", size),
				slog.Duration("duration", time.Since(start)),
			)
			if p.broker != nil {
				out := make([]models.Event, size)
				copy(out, batch)
				p.broker.Publish(out)
			}
		}
		batch = batch[:0]
	}

	for {
		select {
		case event, ok := <-p.events:
			if !ok {
				flush()
				log.Debug("worker exiting")
				return
			}
			batch = append(batch, event)
			if len(batch) >= p.cfg.BatchSize {
				flush()
			}

		case <-ticker.C:
			flush()
		}
	}
}
