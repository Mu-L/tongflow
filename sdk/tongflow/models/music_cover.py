from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicCoverInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    lyrics: str | None = None
    ref_audio: Asset | None = None
    seed: int | None = None
    strength: float | None = None
    text: str | None = None

class MusicCoverOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    audio: Asset | None = None
    error: str | None = None

