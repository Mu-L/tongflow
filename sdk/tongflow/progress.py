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

PROGRESS_SENTINEL = "@@TF_PROGRESS@@"

# Cloud progress callback for the current request: {"progressUrl", "token"} or
# None. Installed per call by @node_slot (mirrors _current_model), so it never
# leaks across requests in a reused container.
_progress_sink: contextvars.ContextVar[dict[str, str] | None] = (
    contextvars.ContextVar("tongflow_progress_sink", default=None)
)


def set_progress_sink(sink: dict[str, str] | None) -> None:
    """Install (or clear) the cloud progress callback for this request."""
    _progress_sink.set(sink)


def _post_progress(sink: dict[str, str], payload: dict[str, object]) -> None:
    """Fire-and-forget POST of one progress event to the Worker callback.

    Shape matches /api/executor/callback's `type:"event"` contract; the token
    is the per-run signed token that binds scope+taskId server-side. Never
    blocks or raises into the plugin — a dropped event is acceptable.
    """
    url = sink.get("progressUrl")
    token = sink.get("token")
    if not url or not token:
        return
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
    # Cloud: also push straight to the Worker callback (remote plugins have no
    # stderr path back to the orchestrator).
    sink = _progress_sink.get()
    if sink:
        _post_progress(sink, payload)
