from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicExtractInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    track: str
    seed: int | None = None

class MusicExtractOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    audio: Asset | None = None
    error: str | None = None

