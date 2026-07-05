from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .asset import Asset, AudioRef, FileRef, ImageRef, ModelRef, VideoRef


class MusicBriefInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    instrumental: bool | None = None
    language: str | None = None

class MusicBriefOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    bpm: float | None = None
    duration: float | None = None
    error: str | None = None
    keyscale: str | None = None
    language: str | None = None
    lyrics: str | None = None
    tags: str | None = None

