"""
Pipeline Service — orchestrates the full processing pipeline as a background task.
Manages job state and coordinates all services.
"""

import asyncio
import json
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import AUDIO_DIR, TRANSCRIPTION_PROVIDER
from models.schemas import JobStatus, StepInfo, AIUsageInfo
from services import db
from services.audio_service import extract_audio
from services.transcription_service import transcribe
from services.ai_service import detect_clips
from services.clip_service import generate_clips
from services.youtube_service import download_video


# Persisted job store
jobs: dict[str, dict] = {}

_JOBS_FILE = Path(__file__).resolve().parent.parent / "jobs.json"


def _apply_clip_options(
    clip_timestamps: list,
    options: dict,
) -> list:
    """Adjust the AI-detected moments to honor the user's clip options.

    ``options`` may contain ``clip_duration`` (target seconds per clip) and/or
    ``clip_count`` (max number of clips).

    When a target duration is chosen, each detected moment is split into
    consecutive sub-clips no longer than that duration, so fewer, longer clips
    become more, shorter ones. When a max count is chosen and we have more
    sub-clips than allowed, only the best-scoring ones are kept.
    """
    from models.schemas import ClipTimestamp

    target_duration = options.get("clip_duration")
    target_count = options.get("clip_count")

    slices: list[ClipTimestamp] = []
    for clip in clip_timestamps:
        start, end = clip.start, clip.end
        if target_duration and target_duration > 0:
            while end - start > target_duration:
                slice_end = start + target_duration
                slices.append(
                    ClipTimestamp(
                        title=clip.title,
                        start=start,
                        end=slice_end,
                        reason=clip.reason,
                        hook_strength=clip.hook_strength,
                        quality_score=clip.quality_score,
                        engagement_prediction=clip.engagement_prediction,
                    )
                )
                start = slice_end
        if end - start > 1:
            slices.append(
                ClipTimestamp(
                    title=clip.title,
                    start=start,
                    end=end,
                    reason=clip.reason,
                    hook_strength=clip.hook_strength,
                    quality_score=clip.quality_score,
                    engagement_prediction=clip.engagement_prediction,
                )
            )

    if not slices:
        return clip_timestamps

    if target_count and target_count > 0 and len(slices) > target_count:
        ranked = sorted(
            slices,
            key=lambda c: ((c.quality_score or 0) + (c.hook_strength or 0)),
            reverse=True,
        )
        slices = ranked[:target_count]
        slices.sort(key=lambda c: c.start)

    return slices


def _save_jobs() -> None:
    _JOBS_FILE.write_text(json.dumps(jobs, indent=2, default=str))


def _load_jobs() -> None:
    if _JOBS_FILE.exists():
        raw = _JOBS_FILE.read_text()
        if raw.strip():
            stored = json.loads(raw)
            jobs.clear()
            jobs.update(stored)


def _mask_secrets(text: str | None) -> str | None:
    """Redact API keys from an error message before it reaches the frontend.

    Google's error messages echo the caller's API key verbatim (api_key:...),
    so raw provider errors must never be stored or returned as-is.
    """
    if not text:
        return text
    s = str(text)

    # Mask any configured keys first (exact match beats pattern guessing).
    try:
        from config import GEMINI_API_KEY, NVIDIA_API_KEY
    except Exception:
        GEMINI_API_KEY = NVIDIA_API_KEY = ""
    for raw in (GEMINI_API_KEY, NVIDIA_API_KEY):
        for key in (k.strip() for k in raw.split(",") if k.strip()):
            if key:
                s = s.replace(key, "***")

    # Then catch any other key-shaped secrets Google or a provider might echo.
    s = re.sub(r"(api_key[:=]\s*)[A-Za-z0-9_.\-]+", r"\1***", s)
    s = re.sub(r"AIza[0-9A-Za-z_\-]{20,}", "AIza***", s)
    s = re.sub(r"\bAQ\.[A-Za-z0-9_.\-]{20,}", "AQ.***", s)
    return s


_load_jobs()
db.sync_all_jobs(jobs)


def create_job(job_id: str, source_type: str, **kwargs) -> dict:
    """Create a new job entry in the store."""
    job = {
        "job_id": job_id,
        "status": JobStatus.PENDING,
        "source_type": source_type,  # "file" or "youtube"
        "video_path": kwargs.get("video_path"),
        "youtube_url": kwargs.get("youtube_url"),
        "video_title": kwargs.get("video_title", ""),
        "user_id": kwargs.get("user_id"),
        "clip_options": kwargs.get("clip_options") or {},
        "created_at": datetime.now(timezone.utc),
        "duration": None,
        "current_step": "Waiting",
        "steps": _build_steps(source_type),
        "clips": [],
        "error": None,
        "ai_usage": None,
    }
    jobs[job_id] = job
    _save_jobs()
    db.sync_job(job)
    return job


def _build_steps(source_type: str) -> list[dict]:
    """Build the step list based on input type."""
    steps = []
    if source_type == "youtube":
        steps.append({"name": "Downloading Video", "status": "pending",
                       "message": "Queued — will download the video from YouTube once the pipeline starts."})
    steps.extend([
        {"name": "Extracting Audio", "status": "pending",
         "message": "Queued — will separate the audio track from the video file for transcription."},
        {"name": "Transcribing Video", "status": "pending",
         "message": "Queued — will convert speech to text with word-level timestamps using Whisper."},
        {"name": "Finding Best Moments", "status": "pending",
         "message": "Queued — will send the transcript to AI to identify the most engaging clips."},
        {"name": "Generating Clips", "status": "pending",
         "message": "Queued — will cut and export each identified moment as a standalone clip."},
    ])
    return steps


def _update_step(job: dict, step_name: str, status: str, message: str = None):
    """Update a specific step's status."""
    for step in job["steps"]:
        if step["name"] == step_name:
            step["status"] = status
            if message:
                step["message"] = message
            break
    job["current_step"] = step_name


def get_job(job_id: str) -> dict | None:
    """Get job info from the store."""
    return jobs.get(job_id)


def mark_video_uploaded(job_id: str, path: Path, title: str | None = None) -> dict:
    """Record that the external worker uploaded the video and resume the pipeline.

    Called by the worker upload endpoint. The job is moved back to PENDING so
    the next ``run_pipeline`` pass picks up the file (its download step is
    skipped because ``video_path`` now exists).
    """
    job = jobs.get(job_id)
    if not job:
        raise KeyError(job_id)
    job["video_path"] = str(path)
    if title:
        job["video_title"] = title
    job["status"] = JobStatus.PENDING
    job["current_step"] = "Waiting"
    job["error"] = None
    for step in job["steps"]:
        if step["name"] == "Downloading Video":
            step["status"] = "pending"
            step["message"] = "Video uploaded by external worker — resuming pipeline."
            break
    _save_jobs()
    db.sync_job(job)
    return job


def get_user_jobs(user_id: str | None) -> list[str]:
    """Get job IDs for a user. If user_id is None, return all jobs."""
    if user_id is None:
        return list(jobs.keys())
    return [jid for jid, job in jobs.items() if job.get("user_id") == user_id]


def get_processing_status(job_id: str) -> dict | None:
    """Get the current processing status for a job."""
    job = jobs.get(job_id)
    if not job:
        return None
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "current_step": job["current_step"],
        "steps": [StepInfo(**s) for s in job["steps"]],
        "error": _mask_secrets(job["error"]),
        "video_title": job["video_title"],
        "source_type": job["source_type"],
        "created_at": job["created_at"],
        "duration": job["duration"],
        "ai_usage": AIUsageInfo(**job["ai_usage"]) if job.get("ai_usage") else None,
        "clip_options": job.get("clip_options") or {},
        "clips_generated": len(job.get("clips", [])),
    }


async def run_pipeline(job_id: str, whisper_model: Any):
    """
    Run the full processing pipeline as a background task.

    Steps:
    1. (YouTube only) Download video
    2. Extract audio from video
    3. Transcribe audio with Whisper
    4. Analyze transcript with AI
    5. Generate video clips with FFmpeg
    """
    job = jobs.get(job_id)
    if not job:
        return

    try:
        # --- Step 0 (YouTube only): Download Video ---
        if job["source_type"] == "youtube":
            job["status"] = JobStatus.DOWNLOADING
            _update_step(job, "Downloading Video", "running", "Connecting to YouTube...")

            existing = job.get("video_path")
            if existing and Path(existing).exists():
                # Resume path: the external download worker already uploaded the
                # video, so skip the (IP-blocked) server-side download.
                video_path = Path(existing)
                title = job.get("video_title") or "YouTube Video"
                file_size_mb = video_path.stat().st_size / (1024 * 1024) if video_path.exists() else 0
                _update_step(job, "Downloading Video", "completed",
                             f"Video ready ({file_size_mb:.1f} MB, downloaded by worker)")
            else:
                try:
                    video_path, title = await download_video(job["youtube_url"], job_id)
                    job["video_path"] = str(video_path)
                    job["video_title"] = title

                    file_size_mb = video_path.stat().st_size / (1024 * 1024) if video_path.exists() else 0
                    _update_step(job, "Downloading Video", "completed",
                                 f"Downloaded {title} ({file_size_mb:.1f} MB)")
                except RuntimeError as exc:
                    from config import WORKER_TOKEN
                    from services.youtube_service import is_bot_wall
                    if WORKER_TOKEN and is_bot_wall(str(exc)):
                        # Server IP is flagged by Google — hand the download to
                        # the external worker and pause until it uploads.
                        job["status"] = JobStatus.WAITING_WORKER
                        _update_step(
                            job, "Downloading Video", "running",
                            "YouTube's bot check blocked the server IP — handed off to the "
                            "external download worker. The job resumes automatically once the "
                            "video is uploaded."
                        )
                        _save_jobs()
                        db.sync_job(job)
                        return
                    raise

        video_path = Path(job["video_path"])

        # --- Step 1: Extract Audio ---
        job["status"] = JobStatus.EXTRACTING_AUDIO
        video_size_mb = video_path.stat().st_size / (1024 * 1024) if video_path.exists() else 0
        _update_step(job, "Extracting Audio", "running",
                     f"Extracting audio track from {video_size_mb:.1f} MB video...")

        audio_path = AUDIO_DIR / f"{job_id}.wav"
        await extract_audio(video_path, audio_path)

        audio_size_mb = audio_path.stat().st_size / (1024 * 1024) if audio_path.exists() else 0
        _update_step(job, "Extracting Audio", "completed",
                     f"Audio extracted — {audio_size_mb:.1f} MB WAV file ready")

        # --- Step 2: Transcribe ---
        job["status"] = JobStatus.TRANSCRIBING
        _update_step(job, "Transcribing Video", "running",
                     f"Transcribing audio with {TRANSCRIPTION_PROVIDER.title()}...")

        transcript = await transcribe(audio_path, whisper_model, job_id)
        job["duration"] = transcript.get("duration")

        num_segments = len(transcript.get("segments", []))
        duration_s = transcript.get("duration", 0)
        duration_m = duration_s / 60

        # A video with (almost) no speech cannot be clipped meaningfully.
        # Fail fast with a clear message instead of blaming the AI provider.
        spoken_text = (transcript.get("text") or "").strip()
        if len(spoken_text) < 20:
            job["status"] = JobStatus.FAILED
            job["error"] = (
                "No speech detected in this video — it may be instrumental, "
                "music-only, or silent. Clip detection needs spoken words. "
                "Try a video with talking or narration."
            )
            job["current_step"] = "Failed"
            for step in job["steps"]:
                if step["status"] == "running":
                    step["status"] = "failed"
                    step["message"] = job["error"]
                    break
            _save_jobs()
            db.sync_job(job)
            return

        _update_step(
            job, "Transcribing Video", "completed",
            f"Transcribed {duration_m:.1f} min of audio into {num_segments} speech segments"
        )

        # --- Step 3: AI Analysis ---
        job["status"] = JobStatus.ANALYZING
        from config import GEMINI_API_KEY, NVIDIA_API_KEY, AI_PROVIDER
        if AI_PROVIDER == "nvidia" or (not AI_PROVIDER and NVIDIA_API_KEY):
            provider_name = "NVIDIA NIM"
        elif GEMINI_API_KEY:
            provider_name = "Gemini"
        else:
            provider_name = "AI"

        _update_step(job, "Finding Best Moments", "running",
                     f"Sending transcript to {provider_name} for clip detection...")

        def update_analysis_retry(message: str):
            _update_step(job, "Finding Best Moments", "running", message)

        clip_timestamps, usage_info = await detect_clips(
            transcript,
            job_id,
            on_retry=update_analysis_retry,
        )

        job["ai_usage"] = usage_info.model_dump()

        reasons = [c.reason[:60] for c in clip_timestamps[:3]]
        reason_preview = ", ".join(reasons) if reasons else ""
        _update_step(
            job, "Finding Best Moments", "completed",
            f"{provider_name} found {len(clip_timestamps)} moments"
            + (f" — e.g. \"{reason_preview}\"" if reason_preview else "")
        )

        # --- Honor user clip options (duration / count) ---
        clip_options = job.get("clip_options") or {}
        if clip_options:
            clip_timestamps = _apply_clip_options(clip_timestamps, clip_options)

        # --- Step 4: Generate Clips ---
        job["status"] = JobStatus.GENERATING_CLIPS
        total_duration = sum(c.end - c.start for c in clip_timestamps)
        _update_step(job, "Generating Clips", "running",
                     f"Cutting {len(clip_timestamps)} clips ({total_duration:.0f}s total video)...")

        clips_info = await generate_clips(video_path, clip_timestamps, job_id)
        job["clips"] = [c.model_dump() for c in clips_info]

        clip_sizes = []
        for ci in clips_info:
            try:
                fpath = video_path.parent.parent / "clips" / job_id / ci.filename
                if fpath.exists():
                    clip_sizes.append(fpath.stat().st_size / (1024 * 1024))
            except Exception:
                pass
        total_size = sum(clip_sizes) if clip_sizes else 0

        _update_step(job, "Generating Clips", "completed",
                     f"Generated {len(clips_info)} clips"
                     + (f" ({total_size:.1f} MB total)" if total_size else ""))

        # --- Done ---
        job["status"] = JobStatus.COMPLETED
        job["current_step"] = "Complete"

        _save_jobs()
        db.sync_job(job)

        # --- Cleanup: remove temporary audio file ---
        try:
            audio_path.unlink(missing_ok=True)
        except Exception:
            pass  # Non-critical cleanup

    except Exception as e:
        job["status"] = JobStatus.FAILED
        job["error"] = _mask_secrets(str(e))
        job["current_step"] = "Failed"

        # Mark current running step as failed
        for step in job["steps"]:
            if step["status"] == "running":
                step["status"] = "failed"
                step["message"] = _mask_secrets(str(e))
                break

        _save_jobs()
        db.sync_job(job)
        traceback.print_exc()
