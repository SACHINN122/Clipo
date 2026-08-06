/**
 * API client for Clipo AI backend.
 */

import { getSessionToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';

function authHeaders() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Check if the backend is reachable. Returns true if healthy, false otherwise.
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Make a fetch request with detailed error handling.
 * Throws descriptive errors for network failures, server errors, etc.
 */
async function apiFetch(url, options = {}) {
  const defaults = {
    credentials: 'include', // send auth cookies with cross-origin requests
    headers: authHeaders(),
  };
  const merged = { ...defaults, ...options };
  if (options.headers) {
    merged.headers = { ...defaults.headers, ...options.headers };
  }
  let res;
  try {
    res = await fetch(url, merged);
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to the backend at ${API_BASE}. ` +
        `Make sure the backend server is running (python3 main.py).`
      );
    }
    throw new Error(`Network error: ${err.message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.detail || body.message || '';
    } catch {
      // non-JSON response
    }

    if (res.status === 404) {
      throw new Error(detail || `Resource not found (${url})`);
    }
    if (res.status === 413) {
      throw new Error('File is too large. Maximum upload size is 5 GB.');
    }
    if (res.status === 422) {
      throw new Error(detail || 'Invalid request. Please check your input.');
    }
    if (res.status >= 500) {
      throw new Error(detail || `Server error (${res.status}). Please try again.`);
    }
    throw new Error(detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Get public config info from the backend.
 */
export async function getConfig() {
  try {
    return await apiFetch(`${API_BASE}/api/config`);
  } catch {
    return null;
  }
}

/**
 * Upload a video file with progress tracking.
 */
export function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error(
        `Cannot connect to the backend at ${API_BASE}. ` +
        `Make sure the backend server is running (python3 main.py).`
      ))
    );
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', `${API_BASE}/api/upload`);
    const token = getSessionToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Submit a YouTube URL for processing.
 */
export async function submitYouTubeUrl(url) {
  return apiFetch(`${API_BASE}/api/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

/**
 * Start the processing pipeline for a job.
 */
export async function startProcessing(jobId) {
  return apiFetch(`${API_BASE}/api/generate/${jobId}`, { method: 'POST' });
}

/**
 * Get all processing jobs.
 */
export async function getAllJobs() {
  return apiFetch(`${API_BASE}/api/jobs`);
}

/**
 * Get current processing status.
 */
export async function getStatus(jobId) {
  return apiFetch(`${API_BASE}/api/status/${jobId}`);
}

/**
 * Get all generated clips for a job.
 */
export async function getClips(jobId) {
  return apiFetch(`${API_BASE}/api/clips/${jobId}`);
}

/**
 * Get the download URL for a clip.
 */
export function getDownloadUrl(jobId, filename) {
  return `${API_BASE}/api/download/${jobId}/${filename}`;
}

/** Get the URL for a ZIP archive containing every clip in a completed job. */
export function getDownloadAllUrl(jobId) {
  return `${API_BASE}/api/download-all/${jobId}`;
}

/**
 * Get the full URL for a static asset (thumbnail, video preview).
 */
export function getStaticUrl(path) {
  return `${API_BASE}${path}`;
}

/**
 * List available caption style variations.
 */
export async function getCaptionStyles() {
  return apiFetch(`${API_BASE}/api/caption-styles`);
}

/**
 * Burn captions into a clip with the requested style (on-demand, no AI).
 */
export async function generateCaptions(jobId, clipId, style) {
  return apiFetch(
    `${API_BASE}/api/captions/${jobId}/${clipId}?style=${encodeURIComponent(style)}`,
    { method: 'POST' },
  );
}

export async function updateProfile(data) {
  return apiFetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getUserStats() {
  return apiFetch(`${API_BASE}/auth/stats`);
}
