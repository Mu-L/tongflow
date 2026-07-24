"""Tests for tongflow.progress — sentinel framing + the thinking flag."""

from __future__ import annotations

import io
import json

from tongflow.progress import PROGRESS_SENTINEL, progress


def _emit(monkeypatch, **kwargs) -> dict:
    buf = io.StringIO()
    monkeypatch.setattr("sys.stderr", buf)
    progress("hello", **kwargs)
    line = buf.getvalue().strip()
    assert line.startswith(PROGRESS_SENTINEL)
    return json.loads(line[len(PROGRESS_SENTINEL) :])


def test_progress_plain(monkeypatch):
    payload = _emit(monkeypatch)
    assert payload == {"message": "hello"}


def test_progress_percent(monkeypatch):
    payload = _emit(monkeypatch, percent=42)
    assert payload["percent"] == 42


def test_progress_thinking_flag(monkeypatch):
    payload = _emit(monkeypatch, thinking=True)
    assert payload["thinking"] is True


def test_progress_thinking_omitted_when_false(monkeypatch):
    payload = _emit(monkeypatch, thinking=False)
    assert "thinking" not in payload
