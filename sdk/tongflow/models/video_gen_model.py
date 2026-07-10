from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class VideoGenModelInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video: Asset

class VideoGenModelOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    error: str | None = None
    model: Asset | None = None

