from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class ImageMattingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image: Asset

class ImageMattingOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    error: str | None = None
    image: Asset | None = None

