"""Cloud single-slot execution wrapper (backend-neutral).

In the cloud, a `@deploy` plugin can serve one ABI slot invocation directly
from its own container over HTTP, with no generic executor in front of it.
The plugin exposes a thin backend endpoint (e.g. Modal's
`@modal.fastapi_endpoint`) that just forwards to :func:`serve_slot`; this
module keeps all the ABI/asset logic and never imports any backend.

Contract — the caller (Worker / orchestrator) POSTs::

    {
      "nodeSlot": "image-gen",
      "method": "image_gen",            # the @node_slot method on the handler
      "input": { ...ABI fields, assets as file_key refs... },
      "assetEndpoint": "https://app.../api/engine-assets",
      "assetToken": "<per-run signed token>",
      "_tongflow": { "progressUrl": "...", "token": "..." }   # optional
    }

:func:`serve_slot` materialises input asset refs into bytes (via HttpStore),
runs the slot method **in-process** through the caller-supplied ``invoke``
(so this file stays backend-neutral — the backend endpoint owns the local
call, e.g. Modal's ``self.method.local(...)``), then converts returned asset
bytes back into refs. The `_tongflow` key rides into the method so
`@node_slot` installs the progress sink.
"""

from __future__ import annotations

import json
import urllib.request
from typing import Any, Callable

from .engine.abi_schema import load_abi_schema, resolve_abi_path
from .engine.assets import (
    convert_asset_outputs_to_file_refs,
    materialize_asset_inputs,
)
from .engine.store import HttpStore

# invoke(method_name, input_dict) -> raw ABI dict. The backend endpoint passes
# a closure that runs the slot locally in this same container.
InvokeFn = Callable[[str, dict[str, Any]], Any]


def serve_slot(payload: dict[str, Any], *, invoke: InvokeFn) -> dict[str, Any]:
    """Run one ABI slot end-to-end inside the plugin's own container."""
    slot = str(payload["nodeSlot"])
    method = str(payload["method"])
    raw_input = payload.get("input")
    inputs_obj = raw_input if isinstance(raw_input, dict) else {}

    abi = load_abi_schema(resolve_abi_path(None))
    store = HttpStore(payload["assetEndpoint"], payload.get("assetToken"))

    materialized = materialize_asset_inputs(slot, inputs_obj, abi, [], store)

    # Ride the progress callback + router model into the slot via @node_slot's
    # reserved keys (popped there before the typed model is built).
    tf = payload.get("_tongflow")
    if tf:
        materialized = {**materialized, "_tongflow": tf}
    model = payload.get("model")
    if model:
        materialized = {**materialized, "_model": model}

    raw = invoke(method, materialized)
    return convert_asset_outputs_to_file_refs(slot, raw, abi, store)


def _post(url: str, body: dict[str, Any]) -> None:
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "tongflow-plugin/1.0",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=30)  # noqa: S310
    except Exception:  # noqa: BLE001 - reporting must never crash the worker
        pass


def run_and_report(payload: dict[str, Any], *, invoke: InvokeFn) -> None:
    """Background single-node runner: execute the slot, then report the
    terminal state to the Worker callback (``callbackUrl``/``callbackToken``).

    Emits a browser-facing terminal event (``type:"event"``) plus the durable
    DB update (``type:"completed"``/``"failed"``) — mirroring the executor, so
    a plugin serving itself needs no bespoke callback code. A slow slot can run
    past the web-endpoint window because the trigger endpoint only spawns this.
    """
    url = payload["callbackUrl"]
    token = payload["callbackToken"]
    try:
        result = serve_slot(payload, invoke=invoke)
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        _post(url, {"token": token, "type": "event",
                    "event": {"status": "FAILED", "data": {"message": "Task execution failed", "error": msg}}})
        _post(url, {"token": token, "type": "failed", "error": msg})
        return
    _post(url, {"token": token, "type": "event",
                "event": {"status": "COMPLETED", "data": result}})
    _post(url, {"token": token, "type": "completed", "result": result})
