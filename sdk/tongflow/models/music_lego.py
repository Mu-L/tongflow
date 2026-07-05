from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicLegoInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    track: str
    lyrics: str | None = None
    seed: int | None = None
    text: str | None = None

class MusicLegoOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    audio: Asset | None = None
    error: str | None = None

