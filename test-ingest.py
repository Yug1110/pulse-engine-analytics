#!/usr/bin/env python3
"""Fire N concurrent random analytics events at the Go ingestion API."""

from __future__ import annotations

import argparse
import asyncio
import random
import time
import uuid
from datetime import datetime, timezone

import aiohttp

EVENT_TYPES = (
    "page_view",
    "click",
    "signup",
    "purchase",
    "scroll",
    "search",
    "add_to_cart",
    "logout",
)

PATHS = ("/", "/pricing", "/docs", "/dashboard", "/checkout", "/settings")
DEVICES = ("desktop", "mobile", "tablet")


def build_event() -> dict:
    event_type = random.choice(EVENT_TYPES)
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "payload": {
            "path": random.choice(PATHS),
            "device": random.choice(DEVICES),
            "session_id": str(uuid.uuid4())[:8],
            "value": round(random.uniform(0, 250), 2) if event_type == "purchase" else None,
        },
    }


async def post_event(
    session: aiohttp.ClientSession,
    url: str,
    sem: asyncio.Semaphore,
    idx: int,
) -> tuple[int, int | None, str | None]:
    async with sem:
        payload = build_event()
        try:
            async with session.post(url, json=payload) as resp:
                body = await resp.text()
                if resp.status >= 400:
                    return idx, resp.status, body[:200]
                return idx, resp.status, None
        except Exception as exc:  # noqa: BLE001 - load test should keep going
            return idx, None, str(exc)


async def run(url: str, count: int, concurrency: int) -> None:
    sem = asyncio.Semaphore(concurrency)
    timeout = aiohttp.ClientTimeout(total=30)
    connector = aiohttp.TCPConnector(limit=concurrency)

    started = time.perf_counter()
    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        tasks = [post_event(session, url, sem, i) for i in range(count)]
        results = await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - started

    ok = sum(1 for _, status, _ in results if status == 202)
    other = count - ok
    rps = count / elapsed if elapsed > 0 else 0.0

    print(f"sent={count} accepted={ok} failed={other} concurrency={concurrency}")
    print(f"elapsed={elapsed:.3f}s throughput={rps:.1f} req/s")

    failures = [(i, status, err) for i, status, err in results if status != 202]
    if failures:
        print("sample failures:")
        for i, status, err in failures[:10]:
            print(f"  #{i} status={status} error={err}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        default="http://localhost:8080/api/v1/events",
        help="Ingestion endpoint",
    )
    parser.add_argument("--count", type=int, default=500, help="Total events to send")
    parser.add_argument(
        "--concurrency",
        type=int,
        default=500,
        help="Max in-flight requests (default: all at once)",
    )
    args = parser.parse_args()
    asyncio.run(run(args.url, args.count, args.concurrency))


if __name__ == "__main__":
    main()
