"""
Upload Service — handles file validation, streaming save, and job ID generation.
"""

import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException

from config import UPLOAD_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES


CHUNK_SIZE = 1024 * 1024  # 1 MB


def validate_file_extension(filename: str) -> str:
    """Validate and return the file extension."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext


async def save_upload(file: UploadFile) -> tuple[str, Path]:
    """
    Stream the uploaded file to disk in chunks.
    Returns (job_id, file_path).
    """
    ext = validate_file_extension(file.filename)
    job_id = uuid.uuid4().hex[:12]
    file_path = UPLOAD_DIR / f"{job_id}{ext}"

    total_bytes = 0

    async with aiofiles.open(file_path, "wb") as out:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                # Clean up partial file
                await out.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is 5 GB."
                )
            await out.write(chunk)

    return job_id, file_path
