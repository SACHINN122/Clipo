"""
AI Service — detects interesting clip moments from transcript.
Supports Gemini 2.5 Flash and NVIDIA NIM (OpenAI-compatible) providers.
"""

import asyncio
import json
from pathlib import Path
from collections.abc import Callable
from google import genai
from google.genai.types import GenerateContentConfig

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_MAX_RETRIES,
    GEMINI_RETRY_BASE_SECONDS,
    GEMINI_RETRY_MAX_SECONDS,
    NVIDIA_API_KEY,
    NVIDIA_NIM_BASE_URL,
    NVIDIA_NIM_MODEL,
    AI_PROVIDER,
    TRANSCRIPT_DIR,
    MIN_CLIP_DURATION,
    MAX_CLIP_DURATION,
)
from models.schemas import ClipTimestamp, AIUsageInfo


SYSTEM_PROMPT = """You are an expert video editor and content strategist. Your job is to analyze a video transcript and identify the most engaging, interesting, and shareable moments that would make great short-form clips (like YouTube Shorts, Instagram Reels, or TikTok).

PRIORITIZE moments that have:
- Strong hooks that grab attention in the first 3 seconds
- Compelling storytelling with a clear narrative arc
- Valuable advice or actionable insights
- Business insights and lessons learned
- Emotional moments that create connection
- Funny or entertaining moments
- Surprising facts or counterintuitive ideas
- Controversial or bold opinions
- Motivational and inspiring moments
- Educational insights that teach something new

AVOID segments that contain:
- Greetings and introductions ("Hey guys, welcome to...")
- Sponsorship reads or ad segments
- Outros and subscription requests
- Long uncomfortable pauses or dead air
- Small talk with no substance
- Filler conversation ("um", "you know", "like")
- Repeated information already covered
- Technical difficulties or off-topic tangents

RULES:
- Each clip should be between {min_duration} and {max_duration} seconds long.
- Aim for 30-60 seconds per clip, but allow up to 90 seconds if the moment truly demands it.
- Choose 5-20 clips depending on how much quality content exists.
- Ensure clips start with a strong hook — never start mid-sentence.
- Ensure clips end at a natural conclusion — never cut off mid-thought.
- Clips should NOT overlap with each other.
- Timestamps must be in seconds (integer or float).
- Provide a short, catchy title for each clip (suitable as a YouTube Shorts title).
- Explain briefly why each moment is interesting.
- Score each clip honestly on three metrics:
  - hook_strength (integer 0-100): how strong the opening 3 seconds are at grabbing attention.
  - quality_score (integer 0-100): overall clip quality (story, pacing, value, production fit for shorts).
  - engagement_prediction ("High", "Medium", or "Low"): expected audience engagement if shared.
  Use the full 0-100 range — reserve 90+ for truly exceptional moments. Return 0 scores only for clips that fail the criteria above, which should be excluded instead.
"""


def _resolve_provider() -> str:
    """Determine which AI provider to use."""
    if AI_PROVIDER:
        return AI_PROVIDER.lower()
    if GEMINI_API_KEY:
        return "gemini"
    if NVIDIA_API_KEY:
        return "nvidia"
    return "none"


def _build_user_prompt(transcript: dict) -> str:
    """Build the user prompt with the transcript text."""
    text = transcript["text"]
    duration = transcript.get("duration", 0)

    # Include segment timestamps for context
    segments_text = ""
    for seg in transcript.get("segments", []):
        start = seg["start"]
        end = seg["end"]
        segments_text += f"[{start:.1f}s - {end:.1f}s] {seg['text']}\n"

    return f"""Analyze this video transcript and identify the best moments for short-form clips.

Video Duration: {duration:.0f} seconds ({duration/60:.1f} minutes)

TRANSCRIPT WITH TIMESTAMPS:
{segments_text}

Return a JSON array of the best clip moments. Each clip should have: title, start (seconds), end (seconds), reason, hook_strength (0-100), quality_score (0-100), engagement_prediction ("High", "Medium", or "Low")."""


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return len(text) // 4


# ---------------------------------------------------------------------------
# Gemini provider
# ---------------------------------------------------------------------------

def _is_transient_gemini_error(error: Exception) -> bool:
    """Return whether a Gemini error is worth retrying automatically."""
    code = str(getattr(error, "code", "")).lower()
    message = str(error).lower()
    transient_markers = ("429", "503", "resource_exhausted", "unavailable")
    return any(marker in code or marker in message for marker in transient_markers)


def _request_clips_sync(client: genai.Client, user_prompt: str, system_instruction: str):
    """Make one synchronous Gemini request; called outside the event loop."""
    return client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=list[ClipTimestamp],
            temperature=0.7,
        ),
    )


async def _detect_clips_gemini(
    user_prompt: str,
    system_instruction: str,
    on_retry: Callable[[str], None] | None,
) -> tuple[list[ClipTimestamp], AIUsageInfo]:
    """Detect clips using Gemini, with retry logic. Returns (clips, usage)."""
    client = genai.Client(api_key=GEMINI_API_KEY)
    usage = AIUsageInfo(provider="gemini", model=GEMINI_MODEL)

    system_token_est = _estimate_tokens(system_instruction)
    user_token_est = _estimate_tokens(user_prompt)
    usage.prompt_tokens_est = system_token_est + user_token_est
    usage.reason = f"Gemini analyzed transcript for best moments"

    for retry_number in range(GEMINI_MAX_RETRIES + 1):
        try:
            response = await asyncio.to_thread(
                _request_clips_sync, client, user_prompt, system_instruction
            )
            break
        except Exception as error:
            if not _is_transient_gemini_error(error) or retry_number >= GEMINI_MAX_RETRIES:
                raise

            delay = min(
                GEMINI_RETRY_BASE_SECONDS * (2 ** retry_number),
                GEMINI_RETRY_MAX_SECONDS,
            )
            if on_retry:
                on_retry(
                    "AI service is busy. "
                    f"Retrying in {delay:g}s "
                    f"({retry_number + 1}/{GEMINI_MAX_RETRIES})..."
                )
            await asyncio.sleep(delay)

    clips = response.parsed
    usage.completion_tokens_est = _estimate_tokens(json.dumps([c.model_dump() for c in clips] if clips else []))
    usage.total_tokens_est = usage.prompt_tokens_est + usage.completion_tokens_est

    return clips or [], usage


# ---------------------------------------------------------------------------
# NVIDIA NIM provider (OpenAI-compatible)
# ---------------------------------------------------------------------------

def _request_clips_nvidia_sync(
    user_prompt: str,
    system_instruction: str,
    model: str,
) -> tuple[list[ClipTimestamp], int, int]:
    """Make one synchronous NVIDIA NIM request via OpenAI SDK. Returns (clips, prompt_tokens, completion_tokens)."""
    from openai import OpenAI

    client = OpenAI(
        base_url=NVIDIA_NIM_BASE_URL,
        api_key=NVIDIA_API_KEY,
    )

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": user_prompt},
    ]

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=4096,
    )

    choice = response.choices[0].message.content
    prompt_tokens = getattr(response.usage, "prompt_tokens", 0) or 0
    completion_tokens = getattr(response.usage, "completion_tokens", 0) or 0

    # Parse JSON array from the response
    try:
        # Try to extract JSON from markdown code blocks
        if "```json" in choice:
            choice = choice.split("```json")[1].split("```")[0]
        elif "```" in choice:
            choice = choice.split("```")[1].split("```")[0]
        clips_raw = json.loads(choice.strip())
        clips = [ClipTimestamp(**c) for c in clips_raw]
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        raise RuntimeError(f"NVIDIA NIM returned invalid clip data: {e}")

    return clips, prompt_tokens, completion_tokens


async def _detect_clips_nvidia(
    user_prompt: str,
    system_instruction: str,
    on_retry: Callable[[str], None] | None,
) -> tuple[list[ClipTimestamp], AIUsageInfo]:
    """Detect clips using NVIDIA NIM. Returns (clips, usage)."""
    usage = AIUsageInfo(provider="nvidia", model=NVIDIA_NIM_MODEL)

    try:
        clips, prompt_tokens, completion_tokens = await asyncio.to_thread(
            _request_clips_nvidia_sync, user_prompt, system_instruction, NVIDIA_NIM_MODEL
        )
    except ImportError:
        raise RuntimeError(
            "OpenAI Python package is required for NVIDIA NIM support. "
            "Install it with: pip install openai"
        )

    usage.prompt_tokens_est = prompt_tokens or _estimate_tokens(user_prompt)
    usage.completion_tokens_est = completion_tokens or _estimate_tokens(json.dumps([c.model_dump() for c in clips]))
    usage.total_tokens_est = usage.prompt_tokens_est + usage.completion_tokens_est
    usage.reason = f"NVIDIA NIM analyzed transcript ({len(clips)} clips found)"

    return clips, usage


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def detect_clips(
    transcript: dict,
    job_id: str,
    on_retry: Callable[[str], None] | None = None,
) -> tuple[list[ClipTimestamp], AIUsageInfo]:
    """
    Send transcript to the configured AI provider and get back interesting clip timestamps.
    Uses structured output with Pydantic schema.
    Returns (clips, usage_info).
    """
    provider = _resolve_provider()
    if provider == "none":
        raise RuntimeError(
            "No AI provider configured. Set GEMINI_API_KEY or NVIDIA_API_KEY in backend/.env"
        )

    system_instruction = SYSTEM_PROMPT.format(
        min_duration=MIN_CLIP_DURATION,
        max_duration=MAX_CLIP_DURATION,
    )
    user_prompt = _build_user_prompt(transcript)

    if provider == "gemini":
        clips, usage = await _detect_clips_gemini(user_prompt, system_instruction, on_retry)
    elif provider == "nvidia":
        clips, usage = await _detect_clips_nvidia(user_prompt, system_instruction, on_retry)
    else:
        raise RuntimeError(f"Unknown AI provider: {provider}")

    if not clips:
        raise RuntimeError(
            f"{provider.title()} returned no clips. The video may not have "
            "enough engaging speech. Try a longer video or a more talk-heavy "
            "segment, then retry."
        )

    # Validate and sanitize timestamps
    video_duration = transcript.get("duration", float("inf"))
    validated = []
    for clip in clips:
        clip.start = max(0, clip.start)
        clip.end = min(video_duration, clip.end)

        if (clip.end - clip.start) < MIN_CLIP_DURATION:
            continue
        if (clip.end - clip.start) > MAX_CLIP_DURATION:
            clip.end = clip.start + MAX_CLIP_DURATION

        validated.append(clip)

    validated.sort(key=lambda c: c.start)

    # Remove overlapping clips (keep the earlier one)
    non_overlapping = []
    for clip in validated:
        if non_overlapping and clip.start < non_overlapping[-1].end:
            continue
        non_overlapping.append(clip)

    usage.reason = (
        f"Analyzed {transcript.get('duration', 0):.0f}s video "
        f"({len(transcript.get('segments', []))} segments, "
        f"{len(non_overlapping)} clips selected)"
    )

    # Save AI response
    clips_path = TRANSCRIPT_DIR / f"{job_id}_clips.json"
    with open(clips_path, "w", encoding="utf-8") as f:
        json.dump([c.model_dump() for c in non_overlapping], f, indent=2)

    return non_overlapping, usage
