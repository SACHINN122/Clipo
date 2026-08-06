"""
Clipo AI — FastAPI Backend Entry Point.
"""

import os
import shutil
import sys
from pathlib import Path
from typing import Any

# --- Add NVIDIA CUDA DLLs to PATH (required on Windows for ctranslate2/faster-whisper) ---
# Must happen before any imports that load CUDA (ctranslate2, faster_whisper)
_venv_nvidia = Path(__file__).parent / "venv" / "Lib" / "site-packages" / "nvidia"
if _venv_nvidia.exists() and sys.platform == "win32":
    _dll_dirs = []
    for subdir in _venv_nvidia.iterdir():
        bin_dir = subdir / "bin"
        if bin_dir.exists():
            _dll_dirs.append(str(bin_dir))
            os.add_dll_directory(str(bin_dir))
    if _dll_dirs:
        os.environ["PATH"] = ";".join(_dll_dirs) + ";" + os.environ.get("PATH", "")

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import CLIP_DIR, FRONTEND_URLS, GEMINI_API_KEY
from routes.api import router as api_router
from routes.auth import router as auth_router
from services.transcription_service import load_local_whisper_model


# Global whisper model — loaded once on startup when available.
whisper_model: Any = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the Whisper model on startup, cleanup on shutdown."""
    global whisper_model

    # ── FFmpeg check ──
    if not shutil.which("ffmpeg"):
        print("=" * 60)
        print("FATAL: ffmpeg is NOT installed or not on PATH.")
        print("=" * 60)
        print()
        print("Clipo requires ffmpeg to extract audio, cut clips, and burn captions.")
        print("Install it for your platform and make sure it's on your PATH:")
        print()
        print("  macOS (Homebrew):  brew install ffmpeg")
        print("  Ubuntu / Debian:   sudo apt update && sudo apt install ffmpeg")
        print("  Fedora / RHEL:     sudo dnf install ffmpeg")
        print("  Windows (winget):  winget install ffmpeg")
        print("  Windows (choco):   choco install ffmpeg")
        print("  Arch Linux:        sudo pacman -S ffmpeg")
        print()
        print("After installing, restart this server.")
        print("=" * 60)
        sys.exit(1)

    print(f"ffmpeg found: {shutil.which('ffmpeg')}")

    # Validate required API keys
    if not GEMINI_API_KEY:
        print("=" * 60)
        print("WARNING: GEMINI_API_KEY is not set!")
        print("AI clip detection will fail without it.")
        print("Add GEMINI_API_KEY=your_key to backend/.env")
        print("=" * 60)

    whisper_model = load_local_whisper_model()
    if whisper_model is None:
        print("Backend will use Gemini transcription fallback for uploads.")
    else:
        print("Whisper model loaded successfully!")

    yield

    # Cleanup
    print("Shutting down...")
    whisper_model = None


app = FastAPI(
    title="Clipo AI",
    description="Convert long-form videos into engaging short-form clips using AI.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server.
# Vite auto-increments the port when the default is busy (5173, 5174, 5175, ...),
# so allow a range of local dev ports on both localhost and 127.0.0.1.
_DEV_PORTS = [3000, 4173, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 8080]
_DEV_ORIGINS = [f"http://localhost:{p}" for p in _DEV_PORTS] + [f"http://127.0.0.1:{p}" for p in _DEV_PORTS]
_PRODUCTION_ORIGINS = [
    u for u in FRONTEND_URLS
    if not u.startswith(("http://localhost", "http://127.0.0.1"))
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEV_ORIGINS + _PRODUCTION_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve clips as static files for video preview/streaming
CLIP_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/clips", StaticFiles(directory=str(CLIP_DIR)), name="clips")

# Register API routes
app.include_router(auth_router)
app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Clipo AI Backend is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
