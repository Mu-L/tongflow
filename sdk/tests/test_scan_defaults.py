"""Scanner tests for `@node_slot(..., default=True)` — the default implementation
of a slot is hoisted to the head of `nodePluginMap[slot]`."""

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

_IMPORTS = """
from tongflow.slots import node_slot, NodeSlots
from tongflow.models.image_gen import ImageGenInput, ImageGenOutput
"""


def _entry_src(decorator: str) -> str:
    return f"""{_IMPORTS}
@node_slot({decorator})
def image_gen(input: ImageGenInput) -> ImageGenOutput:
    ...
"""


def _deploy_src(decorator: str) -> str:
    return f"""{_IMPORTS}
from tongflow import deploy


@deploy
class Inference:
    @node_slot({decorator})
    def image_gen(self, input: ImageGenInput) -> ImageGenOutput:
        ...
"""


def _write_abi(tmp_path: Path) -> Path:
    p = tmp_path / "abi.json"
    p.write_text(json.dumps(_ABI), encoding="utf-8")
    return p


def _write_plugins(tmp_path: Path, sources: dict[str, tuple[str, str]]) -> Path:
    """`sources` maps plugin id -> (filename, source)."""
    root = tmp_path / "plugins"
    for plugin_id, (filename, src) in sources.items():
        pdir = root / plugin_id
        pdir.mkdir(parents=True)
        (pdir / filename).write_text(src, encoding="utf-8")
    return root


def _scan(tmp_path: Path, sources: dict[str, tuple[str, str]]) -> dict:
    return scan(_write_plugins(tmp_path, sources), _write_abi(tmp_path))  # type: ignore[return-value]


def test_no_claim_keeps_directory_order(tmp_path):
    payload = _scan(
        tmp_path,
        {
            "tongflow-api-aaa": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
            "tongflow-api-zzz": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
        },
    )
    assert payload["errors"] == []
    assert payload["nodePluginMap"]["image-gen"] == [
        "tongflow-api-aaa",
        "tongflow-api-zzz",
    ]


def test_default_claim_is_hoisted(tmp_path):
    payload = _scan(
        tmp_path,
        {
            "tongflow-api-aaa": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
            "tongflow-api-zzz": (
                "entry.py",
                _entry_src("NodeSlots.IMAGE_GEN, default=True"),
            ),
        },
    )
    assert payload["errors"] == []
    assert payload["nodePluginMap"]["image-gen"] == [
        "tongflow-api-zzz",
        "tongflow-api-aaa",
    ]


def test_deploy_class_default_claim_is_hoisted(tmp_path):
    payload = _scan(
        tmp_path,
        {
            "tongflow-modal-aaa": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
            "tongflow-modal-zzz": (
                "deploy.py",
                _deploy_src("NodeSlots.IMAGE_GEN, default=True"),
            ),
        },
    )
    assert payload["errors"] == []
    assert payload["nodePluginMap"]["image-gen"] == [
        "tongflow-modal-zzz",
        "tongflow-modal-aaa",
    ]
    assert payload["plugins"]["tongflow-modal-zzz"]["needsDeploy"] is True


def test_two_claims_first_wins_and_errors(tmp_path):
    payload = _scan(
        tmp_path,
        {
            "tongflow-api-aaa": (
                "entry.py",
                _entry_src("NodeSlots.IMAGE_GEN, default=True"),
            ),
            "tongflow-api-zzz": (
                "entry.py",
                _entry_src("NodeSlots.IMAGE_GEN, default=True"),
            ),
        },
    )
    assert payload["nodePluginMap"]["image-gen"] == [
        "tongflow-api-aaa",
        "tongflow-api-zzz",
    ]
    assert any("claimed as default by" in e["message"] for e in payload["errors"])


def test_default_false_is_not_a_claim(tmp_path):
    payload = _scan(
        tmp_path,
        {
            "tongflow-api-aaa": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
            "tongflow-api-zzz": (
                "entry.py",
                _entry_src("NodeSlots.IMAGE_GEN, default=False"),
            ),
        },
    )
    assert payload["errors"] == []
    assert payload["nodePluginMap"]["image-gen"] == [
        "tongflow-api-aaa",
        "tongflow-api-zzz",
    ]


def test_non_literal_default_errors(tmp_path):
    src = _entry_src("NodeSlots.IMAGE_GEN, default=_IS_DEFAULT")
    payload = _scan(tmp_path, {"tongflow-api-aaa": ("entry.py", src)})
    assert any("literal True or False" in e["message"] for e in payload["errors"])
    # The handler itself still registers — only the claim is rejected.
    assert payload["nodePluginMap"]["image-gen"] == ["tongflow-api-aaa"]


def test_claim_covers_every_slot_in_the_same_call(tmp_path):
    multi = f"""{_IMPORTS}
from tongflow.models.gen_text import GenTextInput, GenTextOutput


@node_slot(NodeSlots.IMAGE_GEN, NodeSlots.GEN_TEXT, default=True)
def both(input: ImageGenInput) -> ImageGenOutput:
    ...
"""
    payload = _scan(
        tmp_path,
        {
            "tongflow-api-aaa": ("entry.py", _entry_src("NodeSlots.IMAGE_GEN")),
            "tongflow-api-zzz": ("entry.py", multi),
        },
    )
    assert payload["errors"] == []
    assert payload["nodePluginMap"]["image-gen"][0] == "tongflow-api-zzz"
    assert payload["nodePluginMap"]["gen-text"] == ["tongflow-api-zzz"]
