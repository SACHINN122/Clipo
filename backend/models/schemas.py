"""
Pydantic models for request/response schemas and internal data structures.
"""

from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    UPLOADING = "uploading"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    GENERATING_CLIPS = "generating_clips"
    COMPLETED = "completed"
    FAILED = "failed"


# --- Request Models ---

class YouTubeRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL")


# --- Response Models ---

class UploadResponse(BaseModel):
    job_id: str
    filename: str
    status: JobStatus = JobStatus.PENDING


class StepInfo(BaseModel):
    name: str
    status: str  # "pending", "running", "completed", "failed"
    message: Optional[str] = None


class AIUsageInfo(BaseModel):
    """Tracks AI API usage for display in the frontend."""
    provider: str = ""
    model: str = ""
    prompt_tokens_est: int = 0
    completion_tokens_est: int = 0
    total_tokens_est: int = 0
    reason: str = ""


class ProcessingStatus(BaseModel):
    job_id: str
    status: JobStatus
    current_step: str
    steps: list[StepInfo]
    error: Optional[str] = None
    video_title: str = ""
    source_type: str = "file"
    created_at: datetime
    duration: Optional[float] = None
    ai_usage: Optional[AIUsageInfo] = None
    clips_generated: int = 0


class ClipTimestamp(BaseModel):
    """Schema for AI response — describes one interesting clip."""
    title: str = Field(..., description="Short, catchy title for the clip")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    reason: str = Field(..., description="Why this moment is interesting")
    hook_strength: int = Field(
        default=0,
        ge=0,
        le=100,
        description="How strong the opening 3-second hook is, scored 0-100",
    )
    quality_score: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Overall clip quality score, 0-100",
    )
    engagement_prediction: str = Field(
        default="Medium",
        description="Predicted engagement: High, Medium, or Low",
    )


class TranscriptSegment(BaseModel):
    """One time-coded slice of a transcript."""
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Transcript text for this segment")


class TranscriptResponse(BaseModel):
    """Schema returned by transcription backends."""
    text: str = Field(..., description="Full transcript text")
    segments: list[TranscriptSegment] = Field(default_factory=list)
    language: str = Field(default="en", description="Detected transcript language")


class ClipInfo(BaseModel):
    """Metadata for a generated clip, returned to the frontend."""
    id: int
    title: str
    filename: str
    duration: float
    thumbnail_url: str
    video_url: str
    hook_strength: Optional[int] = None
    quality_score: Optional[int] = None
    engagement_prediction: Optional[str] = None
