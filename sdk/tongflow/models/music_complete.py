from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicCompleteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    seed: int | None = None
    text: str | None = None
    tracks: list[str] | None = None

class MusicCompleteOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    audio: Asset | None = None
    error: str | None = None

