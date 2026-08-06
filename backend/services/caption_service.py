"""
Caption Service — burns word-level captions into clips using FFmpeg + libass.

Style variations are pure ASS styling (no AI calls), so generating captions is
fast and adds no new dependencies. Whisper already produces the required
word-level timestamps, and FFmpeg ships the subtitles/ass filters.
"""

import asyncio
import json
import subprocess
import functools
from pathlib import Path

from config import TRANSCRIPT_DIR, CLIP_DIR, MAX_CAPTION_WORDS
from models.schemas import ClipInfo


def _ass_color(b: int, g: int, r: int) -> str:
    """Build an ASS/FFmpeg colour token in &HBBGGRR& byte order."""
    return f"&H{b:02X}{g:02X}{r:02X}&"


def _ass_time(seconds: float) -> str:
    """Format a duration as ASS timestamp H:MM:SS.CC (centiseconds)."""
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:  # handle rounding overflow
        cs = 0
        s += 1
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


# Each style is a set of ASS styling values. Highlight colour is applied to the
# word currently being spoken (the classic karaoke effect).
CAPTION_STYLES = {
    "classic": {
        "label": "Classic",
        "Fontname": "Arial",
        "Fontsize": 84,
        "Bold": 1,
        "PrimaryColour": _ass_color(255, 255, 255),
        "OutlineColour": _ass_color(0, 0, 0),
        "BackColour": _ass_color(0, 0, 0),
        "Outline": 4,
        "Shadow": 1,
        "Alignment": 2,
        "MarginV": 90,
        "highlight": _ass_color(0, 255, 255),  # yellow
    },
    "neon": {
        "label": "Neon",
        "Fontname": "Arial",
        "Fontsize": 88,
        "Bold": 1,
        "PrimaryColour": _ass_color(255, 255, 255),
        "OutlineColour": _ass_color(20, 20, 70),
        "BackColour": _ass_color(20, 20, 70),
        "Outline": 3,
        "Shadow": 3,
        "Alignment": 2,
        "MarginV": 90,
        "highlight": _ass_color(255, 255, 0),  # cyan
    },
    "bold": {
        "label": "Bold",
        "Fontname": "Arial",
        "Fontsize": 96,
        "Bold": 1,
        "PrimaryColour": _ass_color(255, 255, 255),
        "OutlineColour": _ass_color(0, 0, 0),
        "BackColour": _ass_color(0, 0, 0),
        "Outline": 6,
        "Shadow": 2,
        "Alignment": 2,
        "MarginV": 100,
        "highlight": _ass_color(255, 0, 255),  # magenta
    },
    "minimal": {
        "label": "Minimal",
        "Fontname": "Arial",
        "Fontsize": 64,
        "Bold": 0,
        "PrimaryColour": _ass_color(232, 232, 232),
        "OutlineColour": _ass_color(0, 0, 0),
        "BackColour": _ass_color(0, 0, 0),
        "Outline": 2,
        "Shadow": 0,
        "Alignment": 2,
        "MarginV": 70,
        "highlight": _ass_color(190, 130, 255),  # soft purple
    },
}


def list_styles() -> list[dict]:
    """Return the available caption style keys and labels for the frontend."""
    return [{"key": key, "label": style["label"]} for key, style in CAPTION_STYLES.items()]


def _build_ass(clip_start: float, clip_end: float, words: list[dict], style: str) -> str:
    """Build an ASS subtitle file from clip-relative word timings."""
    st = CAPTION_STYLES[style]
    primary = st["PrimaryColour"]
    highlight = st["highlight"]
    window = MAX_CAPTION_WORDS
    clip_duration = clip_end - clip_start

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,{st['Fontname']},{st['Fontsize']},{primary},{st['OutlineColour']},{st['BackColour']},"
        f"{st['Bold']},0,0,0,100,100,0,0,1,{st['Outline']},{st['Shadow']},{st['Alignment']},60,60,{st['MarginV']},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Text",
    ]

    for i, w in enumerate(words):
        rel_start = w["start"] - clip_start
        rel_end = w["end"] - clip_start
        if rel_end <= 0 or rel_start >= clip_duration:
            continue
        rel_start = max(0.0, rel_start)
        rel_end = min(clip_duration, rel_end)

        # Show a sliding window of recent words with the current word highlighted.
        lo = max(0, i - window + 1)
        window_words = words[lo:i + 1]
        parts = []
        for j, ww in enumerate(window_words):
            color = highlight if (lo + j) == i else primary
            parts.append(f"{{\\c{color}}}{ww['word']}{{\\c{primary}}}")
        text = " ".join(parts).replace(",", "")

        lines.append(
            f"Dialogue: 0,{_ass_time(rel_start)},{_ass_time(rel_end)},Default,{text}"
        )

    return "\n".join(lines)


def _escape_ass_filter(path: str) -> str:
    """Escape an absolute path for FFmpeg's libass subtitles filter.

    libass treats colons as option separators and backslashes as escape
    characters, so any literal `:` or `\\` in a Windows path must be escaped.
    Single quotes are escaped on Windows only since POSIX shells handle them
    differently and FFmpeg on macOS/Linux tolerates unescaped quotes.
    """
    import os
    escaped = path.replace("\\", "\\\\").replace(":", "\\:")
    if os.name == "nt":
        escaped = escaped.replace("'", "\\'")
    return escaped


def _burn_subtitles_sync(clip_dir: Path, source_name: str, ass_name: str, output_name: str) -> None:
    """Burn an ASS subtitle file into a clip (sync, runs in executor).

    Uses absolute paths (with libass-appropriate escaping) instead of
    relying on `cwd`, since relative paths break when the subtitles filter
    parses the argument itself rather than reading from the cwd.
    """
    source_path = str(clip_dir / source_name)
    output_path = str(clip_dir / output_name)
    ass_filter_arg = _escape_ass_filter(str(clip_dir / ass_name))

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", source_path,
                "-vf", f"subtitles={ass_filter_arg}",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-c:a", "copy",
                "-movflags", "+faststart",
                output_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "FFmpeg is not installed or not on PATH. Install it with:\n"
            "  macOS:  brew install ffmpeg\n"
            "  Ubuntu: sudo apt install ffmpeg\n"
            "  Windows: winget install ffmpeg"
        ) from exc
    if result.returncode != 0 or not Path(output_path).exists():
        last_line = result.stderr.strip().splitlines()[-1] if result.stderr else "unknown error"
        raise RuntimeError(f"Caption burn failed: {last_line}")


def generate_captioned_clip(job_id: str, clip_id: int, style: str) -> ClipInfo:
    """
    Burn word-level captions into one clip and return its updated ClipInfo.

    Reads the saved transcript (word timestamps) and clip timestamps, builds an
    ASS subtitle file for the requested style, and re-encodes the clip with the
    subtitles burned in.
    """
    clips_json = TRANSCRIPT_DIR / f"{job_id}_clips.json"
    transcript_json = TRANSCRIPT_DIR / f"{job_id}_transcript.json"

    if not clips_json.exists():
        raise RuntimeError("Clip metadata not found for this job.")
    if not transcript_json.exists():
        raise RuntimeError("Transcript not found for this job.")

    with open(clips_json, encoding="utf-8") as f:
        timestamps = json.load(f)
    if clip_id < 1 or clip_id > len(timestamps):
        raise RuntimeError("Clip not found.")

    ts = timestamps[clip_id - 1]
    clip_start, clip_end = float(ts["start"]), float(ts["end"])

    with open(transcript_json, encoding="utf-8") as f:
        transcript = json.load(f)

    words = []
    for seg in transcript.get("segments", []):
        for w in seg.get("words", []):
            words.append({
                "word": w["word"],
                "start": float(w["start"]),
                "end": float(w["end"]),
            })
    words = [w for w in words if w["start"] >= clip_start - 0.5 and w["end"] <= clip_end + 0.5]
    if not words:
        raise RuntimeError("No transcript words found for this clip.")

    ass_content = _build_ass(clip_start, clip_end, words, style)

    out_dir = CLIP_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    ass_name = f"caption_{clip_id:02d}_{style}.ass"
    (out_dir / ass_name).write_text(ass_content, encoding="utf-8")

    source_name = f"clip_{clip_id:02d}.mp4"
    filename = f"captioned_clip_{clip_id:02d}_{style}.mp4"
    _burn_subtitles_sync(out_dir, source_name, ass_name, filename)

    return ClipInfo(
        id=clip_id,
        title=ts.get("title", "Clip"),
        filename=filename,
        duration=round(clip_end - clip_start, 1),
        thumbnail_url=f"/static/clips/{job_id}/thumb_{clip_id:02d}.jpg",
        video_url=f"/static/clips/{job_id}/{filename}",
    )
