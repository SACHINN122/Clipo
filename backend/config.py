"""
Centralized configuration for Clipo AI backend.
Reads settings from environment variables / .env file.
"""

import base64
import os
import tempfile
import uuid
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
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(PROJECT_ROOT / "uploads")))
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

# --- Transcription Settings ---
# Set TRANSCRIPTION_PROVIDER=whisper to restore the local faster-whisper path.
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "deepgram").strip().lower()
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "").strip()
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL", "nova-3").strip()

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

# --- Supabase Sync ---
# The backend mirrors newly authenticated users into Supabase so the project
# can show real login activity there without changing the existing auth flow.
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", ""))
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", ""))
SUPABASE_USERS_TABLE = os.getenv("SUPABASE_USERS_TABLE", "clipo_users")

# --- Caption Constraints ---
MAX_CAPTION_WORDS = 10   # max words shown on screen at once (sliding window)

# --- Upload Constraints ---
MAX_UPLOAD_SIZE_GB = 5
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_GB * 1024 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi"}

# --- YouTube Constraints ---
MAX_YOUTUBE_DURATION = 3 * 60 * 60  # 3 hours in seconds

# --- YouTube PO token provider (bgutil) ---
# The container ships a small HTTP server (bgutil-ytdlp-pot-provider) that
# mints proof-of-origin tokens. yt-dlp attaches one to the `web` player so it
# can fetch even when YouTube flags the datacenter IP with the "Sign in to
# confirm you're not a bot" wall. Point this at the local server (default) or
# a remote one; set empty to disable the PO-token strategies entirely.
POT_PROVIDER_BASE_URL = os.getenv("POT_PROVIDER_BASE_URL", "http://127.0.0.1:4416").strip()

# --- External download worker ---
# When set, YouTube jobs that hit Google's "Sign in to confirm you're not a
# bot" wall on this server's IP are parked in WAITING_WORKER state and handed
# off to an external downloader (run on an unflagged IP, e.g. the operator's
# home machine via worker_downloader.py). The worker downloads the video and
# uploads it back through /api/worker/upload, after which the pipeline resumes
# server-side. When empty, the handoff is disabled and such jobs fail as before.
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "").strip()

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
        if Path(file_path).is_file() and Path(file_path).stat().st_size > 0:
            return file_path
        return ""

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
# Google OAuth is retained for later, but email/password is the active auth
# method until this flag is explicitly enabled again.
ENABLE_GOOGLE_AUTH = os.getenv("ENABLE_GOOGLE_AUTH", "false").lower() in ("1", "true", "yes")
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

# --- GitHub issue integration (in-app reports become issues) ---
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
# Comma-separated list of "owner/repo" pairs; an issue is created in each repo
# whose token allows it, so both a fork and the upstream can be targeted.
GITHUB_REPO = os.getenv("GITHUB_REPO", "SACHINN122/Clipo")
GITHUB_REPOS = [r.strip() for r in GITHUB_REPO.split(",") if r.strip()] or ["SACHINN122/Clipo"]

# --- PostgreSQL analytics / persistence ---
# Full connection string wins if provided; otherwise it is assembled from the
# DB_* vars. Empty DATABASE_URL disables the DB layer (all DB calls become
# no-ops) so the app still runs locally without Postgres.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    _db_user = os.getenv("DB_USER", "")
    _db_pass = os.getenv("DB_PASSWORD", "")
    _db_host = os.getenv("DB_HOST", "")
    _db_name = os.getenv("DB_NAME", "")
    _db_port = os.getenv("DB_PORT", "5432")
    if _db_user and _db_pass and _db_host and _db_name:
        DATABASE_URL = (
            f"postgresql://{_db_user}:{_db_pass}@{_db_host}:{_db_port}/{_db_name}?sslmode=require"
        )

# Admin panel credentials (seeded into the DB on first run).
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "FiscalMindset")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Iit7065@")
# Comma-separated list of admin GitHub usernames allowed to log in.
ADMIN_USERNAMES = [u.strip() for u in os.getenv("ADMIN_USERNAMES", "FiscalMindset,SACHINN122").split(",") if u.strip()]

# --- Backend identity & telemetry ---
# Each deployment must have a stable BACKEND_ID so telemetry can attribute
# requests/sessions/logs to the right backend. INSTANCE_ID distinguishes
# individual pods/replicas within the same backend.
BACKEND_ID = os.getenv("BACKEND_ID", "").strip()
if not BACKEND_ID:
    # Auto-derive a stable id from the public backend URL when not set.
    _auto_id = ""
    for _candidate in (os.getenv("BACKEND_URL", ""), BACKEND_URL):
        if _candidate and _candidate.startswith(("http://", "https://")):
            _auto_id = _candidate.split("//", 1)[1].split("/", 1)[0].replace(":", "-")
            break
    BACKEND_ID = _auto_id or "local-dev"
BACKEND_NAME = os.getenv("BACKEND_NAME", BACKEND_ID)
BACKEND_VERSION = os.getenv("BACKEND_VERSION", "1.0.2")
BACKEND_REGION = os.getenv("BACKEND_REGION", "unknown")
INSTANCE_ID = os.getenv("INSTANCE_ID", "") or uuid.uuid4().hex[:12]

# When enabled, the app buffers request + server-log telemetry and flushes it
# to Postgres in batches so analytics never blocks the request path.
TELEMETRY_ENABLED = os.getenv("TELEMETRY_ENABLED", "true").lower() in ("1", "true", "yes")
TELEMETRY_FLUSH_SECONDS = float(os.getenv("TELEMETRY_FLUSH_SECONDS", "5"))
TELEMETRY_MAX_BUFFER = int(os.getenv("TELEMETRY_MAX_BUFFER", "500"))

# Friendly display names for known frontends (origin -> name). Used by the
# admin panel so "which frontend did this sign-in come from" is readable.
FRONTEND_NAMES = {
    "https://clipoai.onrender.com": "Render (origin)",
    "https://clipo-6bfs.onrender.com": "Render (fork)",
    "https://white-island-047e3ae00.7.azurestaticapps.net": "Azure SWA",
    "http://localhost:5173": "Local dev",
    "http://localhost:4173": "Local dev",
    "http://localhost:5174": "Local dev",
}
for _extra in os.getenv("FRONTEND_NAME_MAP", "").split(","):
    if "=" in _extra:
        _k, _v = _extra.split("=", 1)
        FRONTEND_NAMES[_k.strip()] = _v.strip()


def frontend_name(origin: str) -> str:
    """Return a friendly name for a frontend origin (falls back to the URL)."""
    origin = (origin or "").strip()
    if not origin:
        return "unknown"
    return FRONTEND_NAMES.get(origin, origin)
