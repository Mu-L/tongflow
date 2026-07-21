"""Asset stores: where a node's binary output lives between/after execution.

- :class:`MemoryStore` (default, ``inline_outputs=True``): outputs stay in
  memory keyed by a ``mem://<id>`` handle — zero files on disk. The runner
  resolves the handles back to ``bytesBase64`` for the caller at the end.
- :class:`DiskStore` (``inline_outputs=False`` / desktop delegation): outputs
  are written to ``out_dir`` and the ``file_key`` is a path (relative to
  ``file_key_base`` when set, else absolute), matching the server's
  ``saveFile`` contract so the canvas can read them via ``/api/uploads``.
- :class:`HttpStore` (``asset_endpoint`` option): the embedding host owns
  file storage (e.g. a cloud backend writing to object storage). ``put``
  POSTs raw bytes over loopback HTTP and gets back the host-assigned
  ``file_key``; ``get`` fetches bytes for any ``file_key`` the host knows.
  The engine never sees storage credentials.

``get`` returns the bytes for a key the store owns, else ``None`` (so the
filesystem/URL resolver in :mod:`assets` handles plain file_keys / URLs).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Optional, Protocol


class AssetStore(Protocol):
    def put(
        self,
        data: bytes,
        *,
        mime: Optional[str] = None,
        filename: Optional[str] = None,
        ext: str = "bin",
    ) -> dict[str, str]: ...

    def get(self, file_key: str) -> Optional[bytes]: ...


class MemoryStore:
    SCHEME = "mem://"

    def __init__(self) -> None:
        self._blobs: dict[str, bytes] = {}

    def put(
        self,
        data: bytes,
        *,
        mime: Optional[str] = None,
        filename: Optional[str] = None,
        ext: str = "bin",
    ) -> dict[str, str]:
        key = f"{self.SCHEME}{uuid.uuid4().hex}"
        self._blobs[key] = data
        out: dict[str, str] = {"file_key": key}
        if mime:
            out["mime"] = mime
        if filename:
            out["filename"] = filename
        return out

    def get(self, file_key: str) -> Optional[bytes]:
        return self._blobs.get(file_key)


class DiskStore:
    def __init__(
        self, out_dir: Path, file_key_base: Optional[Path] = None
    ) -> None:
        self.out_dir = Path(out_dir)
        self.file_key_base = Path(file_key_base) if file_key_base else None

    def _file_key_for(self, path: Path) -> str:
        if self.file_key_base is not None:
            rel = os.path.relpath(path.resolve(), self.file_key_base.resolve())
            return rel.replace(os.sep, "/")
        return str(path.resolve())

    def put(
        self,
        data: bytes,
        *,
        mime: Optional[str] = None,
        filename: Optional[str] = None,
        ext: str = "bin",
    ) -> dict[str, str]:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        path = self.out_dir / f"{uuid.uuid4().hex}.{ext.lstrip('.') or 'bin'}"
        path.write_bytes(data)
        out: dict[str, str] = {"file_key": self._file_key_for(path)}
        if mime:
            out["mime"] = mime
        if filename:
            out["filename"] = filename
        return out

    def get(self, file_key: str) -> Optional[bytes]:
        # Disk file_keys are resolved by the filesystem/URL resolver in assets.
        return None


class HttpStore:
    """Host-managed asset store over (loopback) HTTP.

    The host exposes a single endpoint:

    - ``POST <endpoint>?ext=..&mime=..&filename=..`` with raw bytes as the
      body -> ``{"file_key": "..."}``
    - ``GET <endpoint>?file_key=..`` -> raw bytes (404 when unknown)

    Authentication is a Bearer token minted by the host per engine run.
    """

    # Refs the host sink cannot serve; skip the round trip and let the
    # URL/data resolver in assets handle them.
    _SKIP_PREFIXES = ("http://", "https://", "data:", "mem://")

    def __init__(self, endpoint: str, token: Optional[str] = None) -> None:
        self.endpoint = endpoint
        self.token = token

    def _headers(self) -> dict[str, str]:
        # A non-default User-Agent is required: Cloudflare's bot filtering 403s
        # the stock Python-urllib UA, which breaks asset IO from a plugin
        # container talking to the Worker sink.
        headers = {"User-Agent": "tongflow-sdk/1.0"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def put(
        self,
        data: bytes,
        *,
        mime: Optional[str] = None,
        filename: Optional[str] = None,
        ext: str = "bin",
    ) -> dict[str, str]:
        params = {"ext": ext.lstrip(".") or "bin"}
        if mime:
            params["mime"] = mime
        if filename:
            params["filename"] = filename
        req = urllib.request.Request(
            f"{self.endpoint}?{urllib.parse.urlencode(params)}",
            data=bytes(data),
            method="POST",
            headers={
                "Content-Type": "application/octet-stream",
                **self._headers(),
            },
        )
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        file_key = payload.get("file_key")
        if not isinstance(file_key, str) or not file_key:
            raise RuntimeError("asset endpoint returned no file_key")
        out: dict[str, str] = {"file_key": file_key}
        if mime:
            out["mime"] = mime
        if filename:
            out["filename"] = filename
        return out

    def get(self, file_key: str) -> Optional[bytes]:
        if file_key.startswith(self._SKIP_PREFIXES):
            return None
        req = urllib.request.Request(
            f"{self.endpoint}?{urllib.parse.urlencode({'file_key': file_key})}",
            headers=self._headers(),
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
