"""Daily age-based GC for the v2.1 hosted demo.

Two firing paths so the GC heartbeat survives HF Spaces' 48h-idle-then-
cold-wake cycle:

1. **APScheduler in-process job** — fires at 03:00 UTC every day if the
   container is awake. Configured via `start_scheduler(store)` from the
   FastAPI lifespan.
2. **On-request safety net** — a tiny piece of state (last_gc_at) lives
   in memory; if `>24h` has passed since the last GC and a request comes
   in, the GC kicks off as a background task before the response returns.

Together: when the container wakes up after a long sleep, the first
real request triggers a catch-up GC; while the container is awake, the
APScheduler job is the load-bearing path. Either path is safe to call
multiple times — the SQL guard (`created_at < cutoff`) is idempotent.

Activated only when `GOVOPS_DEMO_MODE=1`. Local dev sees no behaviour
change.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from govops.config import ConfigStore
from govops.demo_mode import is_demo_mode

logger = logging.getLogger("govops.gc_scheduler")


# ---------------------------------------------------------------------------
# In-process state — single-container scope, no Redis
# ---------------------------------------------------------------------------

_state_lock = threading.Lock()
_last_gc_at: Optional[datetime] = None
_scheduler: Optional[BackgroundScheduler] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_last_gc_at() -> Optional[datetime]:
    with _state_lock:
        return _last_gc_at


def _record_gc_run(deleted: int) -> None:
    with _state_lock:
        global _last_gc_at
        _last_gc_at = _utcnow()
    logger.info(
        "gc_scheduler: run complete, deleted=%d at=%s",
        deleted,
        _last_gc_at.isoformat() if _last_gc_at else "?",
    )


# ---------------------------------------------------------------------------
# GC entry point — used by both the scheduler and the admin endpoint
# ---------------------------------------------------------------------------


def run_gc(store: ConfigStore, *, max_age_days: int = 7) -> int:
    """Run the GC sweep and update last_gc_at. Returns deleted count.

    Safe to call multiple times concurrently (the underlying SQL is
    transactional and the cutoff is monotonic-ish over short windows).
    """
    deleted = store.gc_old_user_records(max_age_days=max_age_days)
    _record_gc_run(deleted)
    return deleted


def maybe_run_catchup(store: ConfigStore, *, threshold_hours: float = 24.0) -> bool:
    """If `last_gc_at` is older than `threshold_hours`, kick a GC run.

    Returns True if a GC was triggered, False if last run was recent enough.
    Safe to call from request middleware (does its own bookkeeping).
    """
    if not is_demo_mode():
        return False
    last = get_last_gc_at()
    now = _utcnow()
    if last is not None and (now - last).total_seconds() < threshold_hours * 3600:
        return False
    # Fire-and-forget — caller doesn't wait
    try:
        run_gc(store)
    except Exception:  # noqa: BLE001
        logger.exception("gc_scheduler: catch-up run failed")
    return True


# ---------------------------------------------------------------------------
# APScheduler lifecycle (called from FastAPI lifespan)
# ---------------------------------------------------------------------------


def start_scheduler(store: ConfigStore, *, hour_utc: int = 3, minute_utc: int = 0) -> None:
    """Boot the daily GC job. No-op when not in demo mode."""
    global _scheduler
    if not is_demo_mode():
        logger.info("gc_scheduler: GOVOPS_DEMO_MODE not set — scheduler not started")
        return
    if _scheduler is not None and _scheduler.running:
        logger.info("gc_scheduler: already running")
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        lambda: run_gc(store),
        CronTrigger(hour=hour_utc, minute=minute_utc, timezone="UTC"),
        id="govops-daily-gc",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,  # 1h grace for missed daily runs
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "gc_scheduler: started, daily run at %02d:%02d UTC",
        hour_utc,
        minute_utc,
    )


def shutdown_scheduler() -> None:
    """Tear down the scheduler (called from FastAPI lifespan shutdown)."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("gc_scheduler: shut down")


# ---------------------------------------------------------------------------
# Test/operator helpers
# ---------------------------------------------------------------------------


def reset_state_for_tests() -> None:
    """Reset module-level state. Used by unit tests; never call from app code."""
    global _last_gc_at, _scheduler
    with _state_lock:
        _last_gc_at = None
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
