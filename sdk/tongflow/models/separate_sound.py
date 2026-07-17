from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class SeparateSoundInputRootSpansItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    end: float
    start: float

class SeparateSoundInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    text: str
    spans: list["SeparateSoundInputRootSpansItem"] | None = None

class SeparateSoundOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    error: str | None = None
    residual: Asset | None = None
    target: Asset | None = None

