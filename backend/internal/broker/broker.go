package broker

import (
	"log/slog"
	"sync"

	"github.com/analytics-engine/backend/internal/models"
)

// Broker is a thread-safe fan-out pub/sub for event batches.
// Slow subscribers are skipped (non-blocking send) so publishers never stall.
type Broker struct {
	mu   sync.RWMutex
	subs map[chan []models.Event]struct{}
	log  *slog.Logger
}

// New creates an empty Broker.
func New() *Broker {
	return &Broker{
		subs: make(map[chan []models.Event]struct{}),
		log:  slog.Default().With(slog.String("component", "broker")),
	}
}

// Subscribe registers a new buffered subscriber channel.
func (b *Broker) Subscribe() chan []models.Event {
	ch := make(chan []models.Event, 32)
	b.mu.Lock()
	b.subs[ch] = struct{}{}
	n := len(b.subs)
	b.mu.Unlock()
	b.log.Debug("subscriber added", slog.Int("subscribers", n))
	return ch
}

// Unsubscribe removes and closes a subscriber channel.
func (b *Broker) Unsubscribe(ch chan []models.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.subs[ch]; !ok {
		return
	}
	delete(b.subs, ch)
	close(ch)
	b.log.Debug("subscriber removed", slog.Int("subscribers", len(b.subs)))
}

// SubscriberCount returns the number of active SSE subscribers.
func (b *Broker) SubscriberCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subs)
}

// Publish broadcasts a batch to all current subscribers.
func (b *Broker) Publish(events []models.Event) {
	if len(events) == 0 {
		return
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	delivered := 0
	dropped := 0
	for ch := range b.subs {
		select {
		case ch <- events:
			delivered++
		default:
			dropped++
		}
	}

	if dropped > 0 {
		b.log.Warn("dropped events for slow subscribers",
			slog.Int("batch_size", len(events)),
			slog.Int("delivered", delivered),
			slog.Int("dropped", dropped),
		)
		return
	}
	b.log.Debug("published batch",
		slog.Int("batch_size", len(events)),
		slog.Int("subscribers", delivered),
	)
}
