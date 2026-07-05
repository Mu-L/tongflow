from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicRepaintInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: Asset
    end_time: float
    start_time: float
    lyrics: str | None = None
    seed: int | None = None
    strength: float | None = None
    text: str | None = None

class MusicRepaintOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    audio: Asset | None = None
    error: str | None = None

