"""
Centralized configuration for Clipo AI backend.
Reads settings from environment variables / .env file.
"""

import base64
import os
import tempfile
from pathlib import Path
from dotenv import load_dotenv


def _detect_whisper_device() -> str:
    """Auto-detect the best Whisper device: cuda if available, else cpu."""
    env_device = os.getenv("WHISPER_DEVICE")
    if env_device:
        return env_device
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def _detect_whisper_compute_type(device: str) -> str:
    """Pick a sensible compute type for the device."""
    env_ct = os.getenv("WHISPER_COMPUTE_TYPE")
    if env_ct:
        return env_ct
    return "float16" if device == "cuda" else "int8"

# Load .env: project root first, then backend dir (backend dir takes priority)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

# --- Directory Paths ---
UPLOAD_DIR = PROJECT_ROOT / "uploads"
AUDIO_DIR = PROJECT_ROOT / "audio"
TRANSCRIPT_DIR = PROJECT_ROOT / "transcripts"
CLIP_DIR = PROJECT_ROOT / "clips"
TEMP_DIR = PROJECT_ROOT / "temp"

# Create directories on import
for d in [UPLOAD_DIR, AUDIO_DIR, TRANSCRIPT_DIR, CLIP_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- Whisper Settings ---
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = _detect_whisper_device()
WHISPER_COMPUTE_TYPE = _detect_whisper_compute_type(WHISPER_DEVICE)

# --- Gemini Settings ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
# Retry temporary Gemini service failures (for example HTTP 503) before
# failing an otherwise valid processing job. These remain configurable so a
# local deployment can tune them for its quota and latency requirements.
GEMINI_MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "4"))
GEMINI_RETRY_BASE_SECONDS = float(os.getenv("GEMINI_RETRY_BASE_SECONDS", "2"))
GEMINI_RETRY_MAX_SECONDS = float(os.getenv("GEMINI_RETRY_MAX_SECONDS", "30"))

# --- NVIDIA NIM Settings ---
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_NIM_BASE_URL = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_MODEL = os.getenv("NVIDIA_NIM_MODEL", "nvidia/llama-3.3-70b-instruct")

# --- AI Provider ---
# Which AI provider to use for clip detection: "gemini" or "nvidia"
AI_PROVIDER = os.getenv("AI_PROVIDER", "")  # empty = auto-detect based on available keys

# --- Clip Constraints ---
MIN_CLIP_DURATION = 15   # seconds
MAX_CLIP_DURATION = 120  # seconds
TARGET_CLIP_MIN = 5
TARGET_CLIP_MAX = 20

# --- Caption Constraints ---
MAX_CAPTION_WORDS = 10   # max words shown on screen at once (sliding window)

# --- Upload Constraints ---
MAX_UPLOAD_SIZE_GB = 5
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_GB * 1024 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi"}

# --- YouTube Constraints ---
MAX_YOUTUBE_DURATION = 3 * 60 * 60  # 3 hours in seconds

# Optional cookies file (Netscape format) exported from your browser with a
# "Get cookies.txt" extension. This is the most reliable way to bypass
# YouTube's "Sign in to confirm you're not a bot" wall. Leave empty to fall
# back to --cookies-from-browser and player-client tricks.
#
# The backend accepts the cookies three ways (highest priority first):
#   1. YOUTUBE_COOKIES_FILE — path to an existing cookies.txt on disk.
#   2. YOUTUBE_COOKIES_B64  — base64-encoded cookies.txt content. Used on
#      platforms with an ephemeral filesystem (e.g. Azure Container Apps)
#      where the value arrives via an env secret; it is decoded and written
#      to a temp file at startup.
#   3. YOUTUBE_COOKIES      — raw cookies.txt content (same handling as #2).
def _resolve_youtube_cookies() -> str:
    file_path = os.getenv("YOUTUBE_COOKIES_FILE", "").strip()
    if file_path:
        return file_path

    cookies_b64 = os.getenv("YOUTUBE_COOKIES_B64", "")
    cookies_content = os.getenv("YOUTUBE_COOKIES", "")
    if cookies_b64.strip():
        try:
            cookies_content = base64.b64decode(cookies_b64, validate=True).decode("utf-8")
        except Exception:  # noqa: BLE001 - fall through to raw content below
            cookies_content = ""
    if cookies_content.strip():
        cookie_path = Path(tempfile.gettempdir()) / "clipo_youtube_cookies.txt"
        cookie_path.write_text(cookies_content.strip() + "\n", encoding="utf-8")
        return str(cookie_path)

    return ""


YOUTUBE_COOKIES_FILE = _resolve_youtube_cookies()


# --- Auth / OAuth ---
import secrets
_SECRET_FILE = BACKEND_DIR / ".jwt_secret"


def _load_or_create_secret() -> str:
    env_val = os.getenv("JWT_SECRET")
    if env_val:
        return env_val
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_text().strip()
    secret = secrets.token_hex(32)
    _SECRET_FILE.write_text(secret)
    return secret


JWT_SECRET = _load_or_create_secret()
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Comma-separated list of allowed frontend origins (CORS + OAuth callback
# redirect targets). Defaults to just FRONTEND_URL for backward compatibility.
FRONTEND_URLS = [u.strip() for u in os.getenv("FRONTEND_URLS", FRONTEND_URL).split(",") if u.strip()]
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
SESSION_COOKIE_SECRET = os.getenv("SESSION_COOKIE_SECRET", secrets.token_hex(32))

# --- Email / support settings ---
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "")
