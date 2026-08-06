"""
Auth Routes — Google OAuth 2.0 login/logout/session.
"""

import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote

import httpx

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from jose import jwt, JWTError

from config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    FRONTEND_URLS,
    BACKEND_URL,
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    SESSION_COOKIE_SECRET,
)

router = APIRouter(prefix="/auth")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

COOKIE_NAME = "clipo_session"

_USERS_FILE = Path(__file__).resolve().parent.parent / "users.json"


def _load_users() -> dict[str, dict]:
    if _USERS_FILE.exists():
        raw = _USERS_FILE.read_text()
        if raw.strip():
            return json.loads(raw)
    return {}


def _save_users(users: dict[str, dict]) -> None:
    _USERS_FILE.write_text(json.dumps(users, indent=2, default=str))


def _create_jwt(user_id: str, email: str, name: str, picture: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(request: Request) -> dict | None:
    """Extract current user from session cookie OR Authorization Bearer token.

    Returns None if unauthenticated.
    """
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    payload = _decode_jwt(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    users = _load_users()
    if not user_id or user_id not in users:
        return None
    return users[user_id]


def require_user(request: Request) -> dict:
    """Like get_current_user but raises 401 if not authenticated."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login(state: str = None):
    """Redirect to Google's OAuth consent screen.

    The `state` query param records which frontend origin started the login so
    the callback can redirect the user back to that origin. Defaults to the
    first configured frontend URL.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    origin = FRONTEND_URLS[0]
    if state and state in FRONTEND_URLS:
        origin = state

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": origin,
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str = None, error: str = None, state: str = None):
    """Exchange Google auth code for tokens, create session, redirect to app."""
    origin = state if (state and state in FRONTEND_URLS) else FRONTEND_URLS[0]
    if error:
        return RedirectResponse(url=f"{origin}?error={error}")
    if not code:
        return RedirectResponse(url=f"{origin}?error=no_code")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
                "grant_type": "authorization_code",
            },
            timeout=10,
        )

    if token_resp.status_code != 200:
        return RedirectResponse(url=f"{origin}?error=token_exchange_failed")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        return RedirectResponse(url=f"{origin}?error=no_access_token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )

    if userinfo_resp.status_code != 200:
        return RedirectResponse(url=f"{origin}?error=userinfo_failed")

    info = userinfo_resp.json()
    google_id = info["sub"]
    email = info.get("email", "")
    name = info.get("name", "")
    picture = info.get("picture", "")

    # Upsert user with persistence
    users = _load_users()
    existing = users.get(google_id, {})
    user = {
        "id": google_id,
        "email": email,
        "name": name,
        "display_name": existing.get("display_name", ""),
        "bio": existing.get("bio", ""),
        "picture": picture,
        "created_at": existing.get("created_at", datetime.now(timezone.utc)),
        "last_login": datetime.now(timezone.utc),
    }
    users[google_id] = user
    _save_users(users)

    # Create JWT session
    token = _create_jwt(google_id, email, name, picture)

    # Set cookie and redirect.
    is_https = origin.startswith("https")
    # Cross-origin production (frontend and backend on different hosts) requires
    # SameSite=None + Secure, otherwise the browser drops the cookie on API calls.
    _same_site = "none" if is_https else "lax"
    # The cookie alone is unreliable across origins (third-party cookie blocking),
    # so we also hand the JWT to the frontend via the URL fragment. The frontend
    # stores it in localStorage and sends it as an Authorization: Bearer header.
    callback_path = origin.rstrip("/") + "/auth/callback#token=" + quote(token, safe="")
    response = RedirectResponse(url=callback_path, status_code=302)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite=_same_site,
        max_age=JWT_EXPIRE_HOURS * 3600,
        path="/",
    )
    return response


@router.get("/me")
async def get_me(request: Request):
    """Return the currently authenticated user, or 401."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "display_name": user.get("display_name", ""),
        "bio": user.get("bio", ""),
        "picture": user["picture"],
        "created_at": user["created_at"],
    }


@router.put("/profile")
async def update_profile(request: Request, body: dict):
    """Update display name and bio for the authenticated user."""
    user = require_user(request)
    users = _load_users()
    uid = user["id"]

    if "display_name" in body:
        users[uid]["display_name"] = body["display_name"][:60]
    if "bio" in body:
        users[uid]["bio"] = body["bio"][:300]

    _save_users(users)
    return {"message": "Profile updated"}


@router.get("/stats")
async def get_stats(request: Request):
    """Return usage statistics for the authenticated user."""
    user = require_user(request)

    from services.pipeline_service import jobs, get_user_jobs
    from config import CLIP_DIR
    from models.schemas import JobStatus

    uid = user["id"]
    user_jobs = get_user_jobs(uid)

    total_jobs = len(user_jobs)
    total_clips = 0
    completed_jobs = 0
    total_storage = 0

    for jid in user_jobs:
        job = jobs[jid]
        clips = job.get("clips", [])
        total_clips += len(clips)
        if job.get("status") == JobStatus.COMPLETED:
            completed_jobs += 1
            for c in clips:
                fpath = CLIP_DIR / jid / c["filename"]
                if fpath.exists():
                    total_storage += fpath.stat().st_size

    return {
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "total_clips": total_clips,
        "storage_bytes": total_storage,
        "storage_mb": round(total_storage / (1024 * 1024), 1),
    }


@router.post("/logout")
async def logout():
    """Clear the session cookie."""
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response
