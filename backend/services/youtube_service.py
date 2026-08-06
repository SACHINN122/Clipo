"""
YouTube Service — downloads YouTube videos via yt-dlp.
Uses subprocess.run in a thread executor for Windows compatibility.
"""

import re
import asyncio
import json
import subprocess
import functools
import sys
from pathlib import Path
from fastapi import HTTPException

from config import UPLOAD_DIR, MAX_YOUTUBE_DURATION, YOUTUBE_COOKIES_FILE


YOUTUBE_URL_PATTERN = re.compile(
    r"(https?://)?(www\.|m\.)?"
    r"(youtube\.com/(watch\?v=|shorts/|embed/|live/|v/)|youtu\.be/)"
    r"[\w\-]+"
)

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"


def validate_youtube_url(url: str) -> str:
    """Validate that the URL is a valid YouTube URL."""
    url = url.strip()
    if not YOUTUBE_URL_PATTERN.match(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link."
        )
    return url


_UA_ARG = ["--user-agent", _UA]


def _yt_dlp_strategies() -> list[list[str]]:
    """
    Ordered list of yt-dlp extra-argument sets to try per request.

    YouTube increasingly throws a "Sign in to confirm you're not a bot" wall,
    which makes a plain download fail. We work around it by trying, in order:
      1. A cookies.txt file if configured (most reliable — full auth).
      2. Browser cookies from a logged-in session (zero config).
      3. TV client — the most reliable automated bypass without cookies.
      4. TV + web_safari + ios — broader client fallback.
      5. Default client — fast path when there's no bot wall.
    The first strategy that succeeds wins; if all fail we surface the last error.

    Every strategy also enables ``--remote-components ejs:github``. Recent
    YouTube builds require solving JS challenges (signature + n-parameter);
    yt-dlp needs a JavaScript runtime (deno/node, installed in the Docker
    image) plus its EJS solver-script distribution, which is downloaded from
    GitHub and cached. Without this, only images resolve and the format
    request fails.
    """
    base = ["--remote-components", "ejs:github"]
    strategies: list[list[str]] = []
    if YOUTUBE_COOKIES_FILE:
        strategies.append([*base, "--cookies", YOUTUBE_COOKIES_FILE])
    strategies.extend([
        [*base, "--cookies-from-browser", "chrome"],
        [*base, "--cookies-from-browser", "edge"],
        [*base, "--cookies-from-browser", "brave"],
        [*base, "--extractor-args", "youtube:player_client=tv"],
        [*base, "--extractor-args", "youtube:player_client=tv,web_safari,ios"],
    ])
    if YOUTUBE_COOKIES_FILE:
        strategies.append(
            [*base, "--extractor-args", "youtube:player_client=tv,web_safari,ios",
             "--cookies", YOUTUBE_COOKIES_FILE]
        )
    strategies.append([*base])
    return strategies


def _yt_dlp_command(*args: str) -> list[str]:
    """Run yt-dlp from the same Python environment as the backend.

    Invoking the module avoids relying on a globally installed ``yt-dlp``
    executable, which is especially important on Windows virtual environments.
    """
    return [sys.executable, "-m", "yt_dlp", *args]


def _get_video_info_sync(url: str) -> dict:
    """Fetch video metadata without downloading (sync, runs in executor)."""
    last_err = "No yt-dlp strategies succeeded"
    for extra in _yt_dlp_strategies():
        try:
            result = subprocess.run(
                _yt_dlp_command(*extra, "--dump-json", "--no-download", "--no-warnings", url),
                capture_output=True,
                text=True,
                timeout=180,
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            last_err = result.stderr.strip()
        except Exception as exc:  # noqa: BLE001 - fall through to next strategy
            last_err = str(exc)
    raise RuntimeError(f"Failed to fetch video info: {last_err}")


def _download_video_sync(url: str, output_path: str) -> None:
    """Download video using yt-dlp (sync, runs in executor)."""
    last_err = "No yt-dlp strategies succeeded"
    for extra in _yt_dlp_strategies():
        try:
            result = subprocess.run(
                _yt_dlp_command(
                    *extra,
                    "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                    "--merge-output-format", "mp4",
                    "-o", output_path,
                    "--no-playlist",
                    "--no-warnings",
                    url,
                ),
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout for large videos
            )
            if result.returncode == 0:
                return
            last_err = result.stderr.strip()
        except Exception as exc:  # noqa: BLE001 - fall through to next strategy
            last_err = str(exc)
    raise RuntimeError(
        f"Failed to download video: {last_err}\n\n"
        "YouTube is blocking automated downloads. Fix this permanently by "
        "exporting a cookies.txt file from your logged-in browser "
        "(e.g. the 'Get cookies.txt LOCALLY' extension) and setting "
        "YOUTUBE_COOKIES_FILE in backend/.env (or YOUTUBE_COOKIES_B64 "
        "on Azure)."
    )


async def get_video_info(url: str) -> dict:
    """Fetch video metadata without downloading."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, functools.partial(_get_video_info_sync, url)
    )


async def download_video(url: str, job_id: str) -> tuple[Path, str]:
    """
    Download a YouTube video using yt-dlp.
    Returns (file_path, video_title).
    """
    url = validate_youtube_url(url)

    # Get video info first to check duration
    info = await get_video_info(url)
    duration = info.get("duration", 0)
    title = info.get("title", "YouTube Video")

    if duration > MAX_YOUTUBE_DURATION:
        hours = MAX_YOUTUBE_DURATION // 3600
        raise HTTPException(
            status_code=400,
            detail=f"Video is too long ({duration // 60} min). Maximum allowed is {hours} hours."
        )

    output_path = UPLOAD_DIR / f"{job_id}.mp4"

    # Download in executor
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, functools.partial(_download_video_sync, url, str(output_path))
    )

    if not output_path.exists():
        raise RuntimeError("Download completed but file not found.")

    return output_path, title
