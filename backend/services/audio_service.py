"""
Audio Service — extracts audio from video using FFmpeg.
Uses subprocess.run in a thread executor for Windows compatibility.
"""

import asyncio
import subprocess
import functools
from pathlib import Path


def _extract_audio_sync(video_path: str, output_path: str) -> None:
    """Run FFmpeg audio extraction synchronously (called via executor)."""
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-i", video_path,
                "-vn",              # No video
                "-ar", "16000",     # 16kHz sample rate (Whisper optimal)
                "-ac", "1",         # Mono
                "-f", "wav",        # WAV format
                "-y",               # Overwrite output
                output_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "FFmpeg is not installed or not on PATH. Install it with:\n"
            "  macOS:  brew install ffmpeg\n"
            "  Ubuntu: sudo apt install ffmpeg\n"
            "  Windows: winget install ffmpeg"
        ) from exc
    if result.returncode != 0:
        last_line = result.stderr.strip().split("\n")[-1]
        raise RuntimeError(f"FFmpeg audio extraction failed: {last_line}")


async def extract_audio(video_path: Path, output_path: Path) -> Path:
    """
    Extract audio from a video file as 16kHz mono WAV (optimal for Whisper).
    Uses thread executor to avoid blocking the event loop.
    """
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        functools.partial(_extract_audio_sync, str(video_path), str(output_path)),
    )

    if not output_path.exists():
        raise RuntimeError("Audio extraction completed but output file not found.")

    return output_path
