"""
API Routes for Clipo AI.
"""

import asyncio
import tempfile
import zipfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import subprocess

from config import CLIP_DIR

# API router
from fastapi import APIRouter
router = APIRouter(prefix="/api")
from models.schemas import (
    UploadResponse,
    YouTubeRequest,
    ProcessingStatus,
    ClipInfo,
    JobStatus,
    StepInfo,
)
from services.upload_service import save_upload
from services.youtube_service import validate_youtube_url
from services.pipeline_service import (
    create_job,
    get_job,
    get_processing_status,
    run_pipeline,
    get_user_jobs,
    jobs,
)
from services.caption_service import generate_captioned_clip, list_styles
from routes.auth import get_current_user, require_user


@router.post('/report')
async def report_issue(request: Request, job_id: str | None = None, clip_id: int | None = None, message: str | None = None):
    """Accept user-submitted reports/feedback and store them locally.

    This is intentionally simple: reports are written to the backend `TEMP_DIR`
    as JSON files for later inspection. In production you'd forward these to
    logging/issue trackers or a support inbox.
    """
    user = get_current_user(request)
    user_id = user["id"] if user else None

    try:
        payload = await request.json()
    except Exception:
        payload = {"message": message}

    report = {
        "job_id": job_id or payload.get("job_id"),
        "clip_id": clip_id or payload.get("clip_id"),
        "message": payload.get("message") if payload.get("message") is not None else message,
        "user_id": user_id,
    }

    try:
        import json, time
        fname = TEMP_DIR / f"report-{int(time.time())}.json"
        fname.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save report")

    # Attempt to send an email to support if SMTP is configured
    try:
        from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_USE_TLS, SUPPORT_EMAIL
        if SMTP_HOST and SUPPORT_EMAIL:
            try:
                import json as _json
                from email.message import EmailMessage
                import smtplib

                msg = EmailMessage()
                subj = f"Clipo report" + (f" (job {report['job_id']})" if report.get('job_id') else '')
                msg['Subject'] = subj
                msg['From'] = SMTP_USER or f"noreply@{SMTP_HOST.split(':')[0]}"
                msg['To'] = SUPPORT_EMAIL
                body = _json.dumps(report, ensure_ascii=False, indent=2)
                msg.set_content(body)

                smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
                if SMTP_USE_TLS:
                    smtp.starttls()
                if SMTP_USER and SMTP_PASS:
                    smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)
                smtp.quit()
            except Exception:
                # don't fail the request if email can't be sent; we still saved the report
                pass
    except Exception:
        pass

    return {"status": "ok"}




@router.get("/health")
async def health_check():
    """Check if the backend is running and healthy."""
    from config import GEMINI_API_KEY, NVIDIA_API_KEY, AI_PROVIDER

    if AI_PROVIDER == "nvidia" or (not AI_PROVIDER and NVIDIA_API_KEY):
        provider = "nvidia"
        configured = bool(NVIDIA_API_KEY)
    elif GEMINI_API_KEY:
        provider = "gemini"
        configured = bool(GEMINI_API_KEY)
    else:
        provider = "none"
        configured = False

    return {
        "status": "ok",
        "ai_provider": provider,
        "ai_configured": configured,
        "gemini_configured": bool(GEMINI_API_KEY),
        "nvidia_configured": bool(NVIDIA_API_KEY),
    }


@router.get("/config")
async def get_config():
    """Return public config info the frontend needs."""
    from config import (
        GEMINI_API_KEY, NVIDIA_API_KEY, AI_PROVIDER,
        GEMINI_MODEL, NVIDIA_NIM_MODEL,
        MAX_UPLOAD_SIZE_GB, MAX_YOUTUBE_DURATION, MIN_CLIP_DURATION, MAX_CLIP_DURATION,
    )

    if AI_PROVIDER == "nvidia" or (not AI_PROVIDER and NVIDIA_API_KEY):
        active_provider = "nvidia"
    elif GEMINI_API_KEY:
        active_provider = "gemini"
    else:
        active_provider = "none"

    return {
        "ai_provider": active_provider,
        "gemini_configured": bool(GEMINI_API_KEY),
        "nvidia_configured": bool(NVIDIA_API_KEY),
        "gemini_model": GEMINI_MODEL,
        "nvidia_model": NVIDIA_NIM_MODEL,
        "max_upload_gb": MAX_UPLOAD_SIZE_GB,
        "max_youtube_duration_s": MAX_YOUTUBE_DURATION,
        "min_clip_duration": MIN_CLIP_DURATION,
        "max_clip_duration": MAX_CLIP_DURATION,
    }


@router.post("/upload", response_model=UploadResponse)
async def upload_video(request: Request, file: UploadFile = File(...)):
    """Upload a video file and create a processing job."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job_id, file_path = await save_upload(file)

    create_job(
        job_id,
        source_type="file",
        video_path=str(file_path),
        video_title=file.filename,
        user_id=user_id,
    )

    return UploadResponse(
        job_id=job_id,
        filename=file.filename,
        status=JobStatus.PENDING,
    )


@router.post("/youtube", response_model=UploadResponse)
async def submit_youtube_url(req: Request, request: YouTubeRequest):
    """Accept a YouTube URL and create a processing job."""
    user = get_current_user(req)
    user_id = user["id"] if user else None

    url = validate_youtube_url(request.url)

    # Generate job ID
    import uuid
    job_id = uuid.uuid4().hex[:12]

    create_job(
        job_id,
        source_type="youtube",
        youtube_url=url,
        video_title="YouTube Video",
        user_id=user_id,
    )

    return UploadResponse(
        job_id=job_id,
        filename="YouTube Video",
        status=JobStatus.PENDING,
    )


@router.post("/generate/{job_id}")
async def start_processing(request: Request, job_id: str):
    """Trigger the processing pipeline for a job."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user_id and job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job["status"] not in (JobStatus.PENDING,):
        raise HTTPException(
            status_code=400,
            detail=f"Job is already {job['status'].value}. Cannot start again."
        )

    from main import whisper_model

    # Launch pipeline as a background task. The transcription service will
    # use the local model when available and fall back to Gemini otherwise.
    asyncio.create_task(run_pipeline(job_id, whisper_model))

    return {"message": "Processing started", "job_id": job_id}


@router.get("/status/{job_id}", response_model=ProcessingStatus)
async def get_status(request: Request, job_id: str):
    """Get current processing status for a job."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user_id and job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = get_processing_status(job_id)
    return status


@router.get("/jobs", response_model=list[ProcessingStatus])
async def get_jobs(request: Request):
    """Get all processing jobs for the current user (or all if unauthenticated)."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    result = []
    for jid in get_user_jobs(user_id):
        status = get_processing_status(jid)
        if status:
            result.append(status)
    result.sort(key=lambda x: x["created_at"], reverse=True)
    return result


@router.get("/clips/{job_id}", response_model=list[ClipInfo])
async def get_clips(request: Request, job_id: str):
    """Get all generated clips for a job."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user_id and job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed yet. Current status: {job['status'].value}"
        )

    return [ClipInfo(**c) for c in job["clips"]]


@router.get("/caption-styles")
async def caption_styles():
    """List available caption style variations."""
    return list_styles()


@router.post("/captions/{job_id}/{clip_id}")
async def create_captions(request: Request, job_id: str, clip_id: int, style: str = "classic"):
    """
    Burn word-level captions into a clip using the requested style.

    On-demand and additive: the original clip is untouched and the captioned
    version is returned separately. No AI call is made.
    """
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user_id and job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed yet. Current status: {job['status'].value}"
        )

    clip = next((c for c in job["clips"] if c["id"] == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    try:
        result = generate_captioned_clip(job_id, clip_id, style)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Point the clip at the captioned file so the frontend just swaps the URL.
    clip["filename"] = result.filename
    clip["video_url"] = result.video_url

    return ClipInfo(**clip)


@router.get("/download/{job_id}/{filename}")
async def download_clip(request: Request, job_id: str, filename: str, aspect_ratio: str | None = None):
    """Download a specific clip file.

    Optional query param `aspect_ratio` can be `16:9` or `9:16`. When provided
    the server will transcode the stored clip to the requested aspect ratio and
    return a temporary MP4 file. The temporary file is removed after the
    response is finished.
    """
    clip_path = CLIP_DIR / job_id / filename

    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip not found")

    # Security: ensure the path doesn't escape the clips directory
    try:
        clip_path.resolve().relative_to(CLIP_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    # If no aspect requested, return original file
    if not aspect_ratio:
        return FileResponse(path=str(clip_path), filename=filename, media_type="video/mp4")

    # Validate aspect
    if aspect_ratio not in ("16:9", "9:16"):
        raise HTTPException(status_code=422, detail="Unsupported aspect_ratio; use 16:9 or 9:16")

    # Map to target resolution (use modest defaults to keep transcodes fast)
    if aspect_ratio == "16:9":
        target_w, target_h = 1280, 720
    else:
        target_w, target_h = 720, 1280

    # Probe source dimensions and duration
    try:
        probe = subprocess.run([
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0:s=x",
            str(clip_path)
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        w_h = probe.stdout.decode().strip().split('x')
        src_w, src_h = int(w_h[0]), int(w_h[1])
    except Exception:
        # If probing fails, fall back to original file
        return FileResponse(path=str(clip_path), filename=filename, media_type="video/mp4")

    # Compute crop dimensions to fill target aspect (crop then scale)
    src_ratio = src_w / src_h
    target_ratio = target_w / target_h
    if src_ratio > target_ratio:
        # source is wider -> crop width
        crop_h = src_h
        crop_w = int(round(src_h * target_ratio))
    else:
        # source is taller or equal -> crop height
        crop_w = src_w
        crop_h = int(round(src_w / target_ratio))

    # Default crop center
    crop_x = max(0, (src_w - crop_w) // 2)
    crop_y = max(0, (src_h - crop_h) // 2)

    # Attempt simple smart-crop: use OpenCV face detection on a few sampled frames
    try:
        import cv2
        # extract duration for sampling
        dur_proc = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(clip_path)
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        duration = float(dur_proc.stdout.decode().strip() or 0)
        samples = 6
        centers = []
        with tempfile.TemporaryDirectory() as tmpdir:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if not Path(cascade_path).exists():
                raise RuntimeError('haar cascade not found')
            face_cascade = cv2.CascadeClassifier(cascade_path)
            for i in range(samples):
                ts = (i + 1) * duration / (samples + 1)
                out_img = Path(tmpdir) / f"frame_{i}.jpg"
                ff = subprocess.run([
                    "ffmpeg", "-y", "-ss", str(ts), "-i", str(clip_path), "-frames:v", "1", "-q:v", "2", str(out_img)
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if not out_img.exists():
                    continue
                img = cv2.imread(str(out_img))
                if img is None:
                    continue
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                if len(faces) == 0:
                    continue
                # choose largest face
                faces = sorted(faces, key=lambda r: r[2] * r[3], reverse=True)
                (fx, fy, fw, fh) = faces[0]
                # map face center from thumbnail back to source coords
                ih, iw = img.shape[0], img.shape[1]
                cx = (fx + fw / 2) * (src_w / iw)
                cy = (fy + fh / 2) * (src_h / ih)
                centers.append((cx, cy))
            if centers:
                avg_x = sum(c[0] for c in centers) / len(centers)
                avg_y = sum(c[1] for c in centers) / len(centers)
                # move crop so the face center is centered in crop when possible
                crop_x = int(min(max(0, int(round(avg_x - crop_w / 2))), src_w - crop_w))
                crop_y = int(min(max(0, int(round(avg_y - crop_h / 2))), src_h - crop_h))
    except Exception:
        # Any errors (no cv2, ffmpeg frame extraction issues, etc.) -> stick with center crop
        pass

    # Create a temporary output file
    tmp = tempfile.NamedTemporaryFile(prefix=f"clipo-{job_id}-", suffix=".mp4", delete=False)
    out_path = Path(tmp.name)
    tmp.close()

    vf = f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={target_w}:{target_h}"
    cmd = [
        "ffmpeg", "-y", "-i", str(clip_path),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "copy",
        str(out_path),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to transcode clip: {e.stderr.decode('utf-8', errors='ignore')}")

    return FileResponse(
        path=str(out_path),
        filename=filename,
        media_type="video/mp4",
        background=BackgroundTask(out_path.unlink, missing_ok=True),
    )


@router.get("/download-all/{job_id}")
async def download_all_clips(request: Request, job_id: str):
    """Create a ZIP archive containing every generated clip for a job."""
    user = get_current_user(request)
    user_id = user["id"] if user else None

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user_id and job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Clips are not ready to download yet")

    job_clip_dir = (CLIP_DIR / job_id).resolve()
    clip_paths = []
    for clip in job["clips"]:
        clip_path = (job_clip_dir / clip["filename"]).resolve()
        if clip_path.parent != job_clip_dir or not clip_path.is_file():
            raise HTTPException(status_code=404, detail=f"Clip not found: {clip['filename']}")
        clip_paths.append(clip_path)

    if not clip_paths:
        raise HTTPException(status_code=404, detail="No clips available to download")

    archive = tempfile.NamedTemporaryFile(prefix=f"clipo-{job_id}-", suffix=".zip", delete=False)
    archive_path = Path(archive.name)
    archive.close()
    try:
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            for clip_path in clip_paths:
                zip_file.write(clip_path, arcname=clip_path.name)
    except Exception:
        archive_path.unlink(missing_ok=True)
        raise

    return FileResponse(
        path=str(archive_path),
        filename=f"clipo-clips-{job_id}.zip",
        media_type="application/zip",
        background=BackgroundTask(archive_path.unlink, missing_ok=True),
    )
