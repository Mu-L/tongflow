"""Scanner tests for the optional TONGFLOW_SLOT_PARAMS declaration."""

from __future__ import annotations

import json
from pathlib import Path

from tongflow.scan import scan

_ABI = {
    "version": 1,
    "$defs": {"Asset": {"type": "object"}, "ImageRef": {"type": "object"}},
    "nodes": [
        {
            "nodeSlot": "image-gen",
            "inputs": {"type": "object", "properties": {"text": {"type": "string"}}},
            "outputs": {
                "type": "object",
                "properties": {"image": {"$ref": "#/$defs/ImageRef"}},
            },
        },
        {
            "nodeSlot": "gen-text",
            "inputs": {"type": "object", "properties": {"text": {"type": "string"}}},
            "outputs": {"type": "object", "properties": {"text": {"type": "string"}}},
        },
    ],
}

_HANDLERS = '''
from tongflow.slots import node_slot, NodeSlots
from tongflow.models.image_gen import ImageGenInput, ImageGenOutput

@node_slot(NodeSlots.IMAGE_GEN)
def image_gen(input: ImageGenInput) -> ImageGenOutput:
    ...
'''

_PARAMS = '''
TONGFLOW_SLOT_PARAMS = {
    "image-gen": {
        "steps": {"type": "select", "options": [8, 20, 40], "default": 20, "label": "Steps"},
        "turbo": {"type": "boolean", "default": False},
        "shift": {"type": "number", "default": 12.0, "min": 1, "max": 20, "step": 0.5},
        "sampler": {"type": "text", "default": "euler"},
        "guidance": {"type": "integer", "default": 4, "models": ["m-a"]},
    },
}
'''


def _scan(tmp_path: Path, entry_src: str) -> dict:
    abi = tmp_path / "abi.json"
    abi.write_text(json.dumps(_ABI), encoding="utf-8")
    root = tmp_path / "plugins"
    pdir = root / "tongflow-api-fake"
    pdir.mkdir(parents=True)
    (pdir / "entry.py").write_text(entry_src, encoding="utf-8")
    return scan(root, abi)  # type: ignore[return-value]


def _entry(payload: dict) -> dict:
    return payload["plugins"]["tongflow-api-fake"]["methodsByNodeSlot"]["image-gen"]


def test_scan_without_params_is_unchanged(tmp_path):
    payload = _scan(tmp_path, _HANDLERS)
    assert payload["errors"] == []
    assert _entry(payload) == {"methodName": "image_gen"}


def test_scan_with_params_attaches_specs_in_declared_order(tmp_path):
    payload = _scan(tmp_path, _PARAMS + _HANDLERS)
    assert payload["errors"] == []
    params = _entry(payload)["params"]
    assert list(params) == ["steps", "turbo", "shift", "sampler", "guidance"]
    assert params["steps"] == {
        "type": "select",
        "options": [8, 20, 40],
        "default": 20,
        "label": "Steps",
    }
    assert params["guidance"]["models"] == ["m-a"]
    # The registry is JSON: booleans must survive as booleans.
    assert json.loads(json.dumps(params))["turbo"]["default"] is False


def test_scan_params_slot_without_handler_errors(tmp_path):
    src = (
        'TONGFLOW_SLOT_PARAMS = {"gen-text": {"temperature": {"type": "number"}}}\n'
        + _HANDLERS
    )
    payload = _scan(tmp_path, src)
    assert any("no @node_slot handler" in e["message"] for e in payload["errors"])
    assert "params" not in _entry(payload)


def test_scan_params_non_literal_errors(tmp_path):
    src = (
        "_STEPS = [8, 20]\n"
        'TONGFLOW_SLOT_PARAMS = {"image-gen": {"steps": {"type": "select", "options": _STEPS}}}\n'
        + _HANDLERS
    )
    payload = _scan(tmp_path, src)
    assert any("pure dict literal" in e["message"] for e in payload["errors"])
    assert "params" not in _entry(payload)


def test_scan_params_rejects_bad_shapes(tmp_path):
    cases = {
        # unknown control type
        '{"image-gen": {"x": {"type": "slider"}}}': "'type' must be one of",
        # select without options
        '{"image-gen": {"x": {"type": "select"}}}': "non-empty 'options'",
        # default outside options
        '{"image-gen": {"x": {"type": "select", "options": ["a"], "default": "b"}}}': "must be one of 'options'",
        # boolean default that is not a bool
        '{"image-gen": {"x": {"type": "boolean", "default": 1}}}': "True or False",
        # non-identifier param name
        '{"image-gen": {"bad name": {"type": "text"}}}': "identifiers",
        # unknown spec key
        '{"image-gen": {"x": {"type": "text", "placeholder": "y"}}}': "unknown keys",
    }
    for literal, needle in cases.items():
        d = tmp_path / needle.replace(" ", "_").replace("'", "")[:20]
        d.mkdir()
        payload = _scan(d, f"TONGFLOW_SLOT_PARAMS = {literal}\n" + _HANDLERS)
        assert any(needle in e["message"] for e in payload["errors"]), (literal, payload["errors"])
        assert "params" not in _entry(payload)
