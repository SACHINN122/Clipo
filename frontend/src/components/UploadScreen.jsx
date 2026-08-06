import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadVideo, submitYouTubeUrl, getConfig } from '../lib/api';
import { requestNotificationPermission, supportsNotifications } from '../lib/notifications';
import { unlockAudio } from '../lib/sound';
import StudioHeader from './StudioHeader';

const ACCEPTED_TYPES = '.mp4,.mov,.mkv,.avi';
const MAX_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const PIPELINE = [
  { label: 'Upload',     icon: 'arrow',  tone: 'cyan',   summary: 'Waiting for your source',      detail: 'MP4, MOV, MKV, or AVI up to 5 GB. YouTube links are downloaded automatically.', duration: '~30 sec' },
  { label: 'Transcribe', icon: 'wave',   tone: 'violet', summary: 'Local, word-level timestamps', detail: 'Whisper runs on your machine. No audio is uploaded to the cloud.',          duration: '1–3 min' },
  { label: 'AI analysis',icon: 'spark',  tone: 'pink',   summary: 'Find moments with momentum',   detail: 'Detects hooks, emotion shifts, and natural breakpoints worth sharing.',    duration: '20–40 sec' },
  { label: 'Generate clips', icon: 'clip', tone: 'amber', summary: 'Cut and caption automatically',detail: 'Vertical reframing, captions, and per-clip metadata — ready to publish.', duration: '1–2 min' },
  { label: 'Export',     icon: 'export', tone: 'green',  summary: 'Download in one click',        detail: 'Save individual clips or the whole batch. Pick format right before export.', duration: '~10 sec' },
];
const BENEFITS = [
  ['01', 'Fast, local processing', 'Your footage stays on your machine.'],
  ['02', 'Private by default', 'No creative work leaves your workflow.'],
  ['03', 'GPU accelerated', 'Built for longer videos and faster turnaround.'],
  ['04', 'Viral moment detection', 'AI identifies hooks worth sharing.'],
  ['05', 'One-click export', 'Social-ready clips, ready to publish.'],
];
const YOUTUBE_ERROR = 'Please enter a valid YouTube video URL (youtube.com/watch?v=... or youtu.be/...)';

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    upload: <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16.5v2.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V16.5" />,
    link: <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15" />,
    play: <path fill="currentColor" stroke="none" d="M8 5v14l11-7z" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    wave: <path d="M4 12h2l2-6 4 12 2-7 2 3h4" />,
    spark: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Zm6.5 12 .6 2 1.9.5-1.9.6-.6 1.9-.5-1.9-2-.6 2-.5.5-2Z" />,
    clip: <path d="M7 4v16m10-16v16M7 8h10M7 16h10" />,
    export: <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13.5v5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-5" />,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.1h-3v-.1A1.7 1.7 0 0 0 10.7 18.64a1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.06 15a1.7 1.7 0 0 0-1.56-1.03h-.1v-3h.1A1.7 1.7 0 0 0 7.06 9.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.1h3v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z" /></>,
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2m-6-2v2m6 16v2m-6-2v2m11-10h2M2 15h2m16-6h2M2 9h2" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  };
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">{paths[name]}</svg>;
}

const formatFileSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const validYoutube = (value) => /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[\w-]+/.test(value.trim());

const JOB_HISTORY_KEY = 'clipo_job_history';
const MAX_HISTORY = 20;

function loadJobHistory() {
  try {
    const raw = localStorage.getItem(JOB_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJobHistory(history) {
  try {
    localStorage.setItem(JOB_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* storage full or unavailable */ }
}

function formatJobTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function UploadScreen({ onProcessingStart, onNavigate, onVisitJob }) {
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [notify, setNotify] = useState(false);
  const [jobHistory, setJobHistory] = useState(loadJobHistory);
  const [backendConfig, setBackendConfig] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    getConfig().then((cfg) => { if (cfg) setBackendConfig(cfg); }).catch(() => { });
  }, []);

  const selectFile = useCallback((nextFile) => {
    setError('');
    if (!nextFile) return;
    const ext = `.${nextFile.name.split('.').pop().toLowerCase()}`;
    if (!ACCEPTED_TYPES.includes(ext)) return setError('Choose an MP4, MOV, MKV, or AVI video.');
    if (nextFile.size > MAX_SIZE_BYTES) return setError('This file exceeds the 5 GB upload limit.');
    setFile(nextFile);
  }, []);

  const canGenerate = activeTab === 'file' ? !!file : validYoutube(youtubeUrl);

  const generate = async () => {
    setUploading(true);
    setError('');
    setUploadProgress(0);
    unlockAudio();
    try {
      let notificationsEnabled = notify;
      if (notify) notificationsEnabled = (await requestNotificationPermission()) === 'granted';
      const response = activeTab === 'file'
        ? await uploadVideo(file, setUploadProgress)
        : await submitYouTubeUrl(youtubeUrl.trim());
      const videoName = response.filename || (activeTab === 'youtube' ? 'YouTube video' : file?.name);
      const newJob = {
        jobId: response.job_id,
        videoName,
        sourceType: activeTab,
        createdAt: new Date().toISOString(),
      };
      const updated = [newJob, ...jobHistory.filter((j) => j.jobId !== response.job_id)].slice(0, MAX_HISTORY);
      setJobHistory(updated);
      saveJobHistory(updated);
      onProcessingStart(response.job_id, {
        notifyWhenComplete: notificationsEnabled,
        videoName,
        sourceType: activeTab,
        createdAt: newJob.createdAt,
      });
    } catch (err) {
      setError(err.message || 'Unable to create this job. Please try again.');
      setUploading(false);
    }
  };

  const clearHistory = () => {
    setJobHistory([]);
    saveJobHistory([]);
  };

  const handleYouTubeChange = (e) => {
    const value = e.target.value;
    setYoutubeUrl(value);
    if (value && !validYoutube(value)) {
      setError(YOUTUBE_ERROR);
    } else {
      setError('');
    }
  };

  const aiProvider = backendConfig?.ai_provider || 'none';
  const nvidiaConfigured = backendConfig?.nvidia_configured || false;

  return <div className="dashboard-shell">
    <div className="dashboard-aura" />
    <div className="dashboard-frame">
      <StudioHeader activeTab="create" onNavigate={onNavigate} rightSlot={<button className="icon-button" aria-label="Settings" onClick={() => onNavigate?.('settings')}><Icon name="settings" /></button>} />
      <main>
        <div className="workspace-grid">
          <section className="upload-workspace">
            <div className="eyebrow">Create a new project</div>
            <h1>Turn one long video<br />into <span>viral clips.</span></h1>
            <p className="workspace-intro">Upload a video or paste a YouTube link. AI detects the best moments, writes captions and exports social-ready clips.</p>
            <div className="source-tabs" role="tablist">
              <button className={activeTab === 'file' ? 'active' : ''} onClick={() => setActiveTab('file')}><Icon name="upload" />Upload file</button>
              <button className={activeTab === 'youtube' ? 'active' : ''} onClick={() => setActiveTab('youtube')}><Icon name="link" />YouTube URL</button>
            </div>
            {activeTab === 'file' ? <div className={`dropzone ${dragover ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onClick={() => !uploading && input.current?.click()} onDrop={(e) => { e.preventDefault(); setDragover(false); selectFile(e.dataTransfer.files?.[0]); }} onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)}>
              <input ref={input} className="hidden" type="file" accept={ACCEPTED_TYPES} onChange={(e) => selectFile(e.target.files?.[0])} />
              <div className="drop-icon"><Icon name={file ? 'check' : 'upload'} /></div>
              {file ? <><strong>{file.name}</strong><span>{formatFileSize(file.size)} · Ready to generate</span></> : <><strong>Drop your video here</strong><span>or click to browse from your computer</span></>}
            </div> : <div className={`url-entry ${youtubeUrl && !validYoutube(youtubeUrl) ? 'has-error' : ''}`}><Icon name="play" /><input autoFocus value={youtubeUrl} onChange={handleYouTubeChange} placeholder="Paste a YouTube URL" /><button onClick={async () => { try { setYoutubeUrl(await navigator.clipboard.readText()); } catch { setError('Paste your URL directly into the field.'); } }}>Paste</button></div>}

            {aiProvider === 'nvidia_nim' && nvidiaConfigured && (
              <div className="ai-provider-badge"><Icon name="cpu" /><span>NVIDIA NIM active</span></div>
            )}
            {aiProvider === 'gemini' && (
              <div className="ai-provider-badge"><Icon name="spark" /><span>Gemini active</span></div>
            )}
            {aiProvider === 'none' && (
              <div className="ai-provider-badge ai-provider-none"><Icon name="cpu" /><span>AI unavailable — clips will use transcript only</span></div>
            )}

            <div className="upload-meta"><span>MP4 · MOV · MKV · AVI</span><span>Up to 5 GB</span><span>Video stays local</span></div>
            {uploading && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /></div>}
            {error && <p className="form-error">{error}</p>}
            <div className="generate-row"><button className="generate-button" disabled={!canGenerate || uploading} onClick={generate}>{uploading ? `Uploading ${uploadProgress}%` : <><Icon name="spark" />Generate clips</>}</button><div><strong>Usually ready in 4–8 min</strong><span>depending on video length</span></div></div>
            {supportsNotifications() && <label className="notification-toggle"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /><span />Notify me when exports are ready</label>}
          </section>
          <aside className="pipeline-panel">
            <div className="pipeline-header">
              <div className="pipeline-eyebrow">
                <span className="eyebrow">Your workflow</span>
                <span className="pipeline-counter">{PIPELINE.length} steps · ~4–8 min</span>
              </div>
              <h2>From raw footage<br />to ready-to-post.</h2>
              <div className="pipeline-progress" aria-hidden="true">
                {PIPELINE.map((step, i) => (
                  <span
                    key={step.label}
                    className={`pipeline-progress-dot ${i === 0 ? 'is-active' : ''}`}
                  />
                ))}
              </div>
            </div>
            <ol className="pipeline-flow">
              {PIPELINE.map((step, index) => (
                <li
                  key={step.label}
                  className={`pipeline-step ${index === 0 ? 'is-current' : ''} tone-${step.tone}`}
                >
                  <span className="pipeline-step-rail" aria-hidden="true">
                    <span className="pipeline-step-icon">
                      <Icon name={step.icon} />
                    </span>
                    {index < PIPELINE.length - 1 && <span className="pipeline-step-line" />}
                  </span>
                  <div className="pipeline-step-body">
                    <div className="pipeline-step-head">
                      <span className="pipeline-step-num">{String(index + 1).padStart(2, '0')}</span>
                      <strong>{step.label}</strong>
                      <span className="pipeline-step-duration">{step.duration}</span>
                    </div>
                    <p className="pipeline-step-summary">{step.summary}</p>
                    <p className="pipeline-step-detail">{step.detail}</p>
                  </div>
                  {index === 0 && (
                    <span className="pipeline-step-badge" aria-label="Ready">
                      <span className="pipeline-step-dot" />
                      Ready
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="pipeline-foot">
              <span className="live-dot" />
              <div>
                <strong>Local GPU is ready</strong>
                <span>Everything runs on your machine</span>
              </div>
            </div>
          </aside>
        </div>

        <section className="recent-section">
          <div className="section-heading">
            <div><div className="eyebrow">Library</div><h2>Recent jobs</h2></div>
            {jobHistory.length > 0 && <button className="ghost-button" onClick={clearHistory}>Clear all</button>}
          </div>
          {jobHistory.length === 0 ? (
            <div className="empty-jobs">
              <div className="empty-art"><i /><i /><i /><b><Icon name="spark" /></b></div>
              <h3>Your Clipo creative queue is clear.</h3>
              <p>Your recent projects will appear here, ready to preview, revisit and export.</p>
            </div>
          ) : (
            <div className="job-history-list">
              {jobHistory.map((job) => (
                <div className="job-history-item" key={job.jobId} onClick={() => onVisitJob?.(job.jobId, job)}>
                  <div className="job-history-icon"><Icon name={job.sourceType === 'youtube' ? 'link' : 'upload'} /></div>
                  <div className="job-history-info">
                    <strong title={job.videoName}>{job.videoName}</strong>
                    <span><Icon name="clock" /> {formatJobTime(job.createdAt)}</span>
                  </div>
                  <span className="job-history-id">{job.jobId?.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="benefits"><div><div className="eyebrow">Made for creators</div><h2>Everything between<br />idea and publish.</h2></div><div className="benefit-list">{BENEFITS.map(([number, title, description]) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></div>)}</div></section>
      </main>
    </div>
  </div>;
}
