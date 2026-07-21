"""Backend-neutral progress reporting for plugins.

A plugin reports progress by calling :func:`progress`. It always writes a
single sentinel-framed line to **stderr** (stdout is reserved for the ABI-JSON
result), which the platform's generic runner parses locally.

Cloud mode: when the platform runs a plugin remotely (its own Modal function),
stderr never reaches the orchestrator, so the same event is ALSO POSTed to a
progress callback. The callback target is not passed as an argument (the slot
signature is ABI-locked); the `@node_slot` wrapper pulls it from the reserved
`_tongflow` key on the incoming dict and installs it here via
:func:`set_progress_sink`. When no sink is installed (desktop / local runs)
behaviour is unchanged — pure stderr.

The sentinel must stay byte-for-byte identical to the TypeScript side
(`src/lib/plugin-executor/progress-protocol.ts`).
"""

from __future__ import annotations

import contextvars
import json
import sys
import threading
import urllib.request
from typing import Callable

PROGRESS_SENTINEL = "@@TF_PROGRESS@@"

# Progress sink for the current request: a callable that receives each event
# payload ({"message", "percent"?}), or None. It is a plain callback so the
# same plumbing serves both transports — an HTTP POST to the Worker (remote
# executor path) and an in-process queue (streaming serve, one container).
# contextvar-scoped so it never leaks across requests in a reused container.
ProgressSink = Callable[[dict[str, object]], None]
_progress_sink: contextvars.ContextVar[ProgressSink | None] = (
    contextvars.ContextVar("tongflow_progress_sink", default=None)
)


def set_progress_sink(sink: ProgressSink | None) -> None:
    """Install (or clear) the progress sink for this request/thread."""
    _progress_sink.set(sink)


def http_progress_sink(url: str, token: str) -> ProgressSink:
    """A sink that fire-and-forget POSTs each event to the Worker callback.

    Shape matches /api/executor/callback's `type:"event"` contract; the token
    is the per-run signed token that binds scope+taskId server-side. Never
    blocks or raises into the plugin — a dropped event is acceptable.
    """

    def _sink(payload: dict[str, object]) -> None:
        body = json.dumps(
            {
                "token": token,
                "type": "event",
                "event": {"status": "RUNNING", "data": payload},
            }
        ).encode()

        def _send() -> None:
            try:
                req = urllib.request.Request(
                    url,
                    data=body,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "tongflow-plugin/1.0",
                    },
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=15)  # noqa: S310
            except Exception:  # noqa: BLE001 - progress must never break the run
                pass

        threading.Thread(target=_send, daemon=True).start()

    return _sink


def progress(message: str, *, percent: float | None = None) -> None:
    """Emit a progress update. ``percent`` is an optional 0–100 hint."""
    payload: dict[str, object] = {"message": str(message)}
    if percent is not None:
        payload["percent"] = percent
    line = PROGRESS_SENTINEL + json.dumps(payload, ensure_ascii=False)
    # One write + flush so the line is delivered promptly and never interleaves
    # with the JSON result on stdout.
    sys.stderr.write(line + "\n")
    sys.stderr.flush()
    # Cloud: also hand the event to the installed sink (HTTP callback or the
    # streaming serve's queue). Remote plugins have no stderr path back.
    sink = _progress_sink.get()
    if sink:
        try:
            sink(payload)
        except Exception:  # noqa: BLE001 - progress must never break the run
            pass
