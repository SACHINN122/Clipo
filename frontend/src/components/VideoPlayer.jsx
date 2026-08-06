import { useEffect, useRef, useState } from 'react';
import { getDownloadUrl, getStaticUrl, getCaptionStyles, generateCaptions } from '../lib/api';

function Icon({ name }) { const paths = { close: <path d="m6 6 12 12M18 6 6 18" />, download: <><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M4 20h16" /></>, expand: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />, share: <><path d="M18 8a3 3 0 1 0-2.8-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 2.8 4A3 3 0 0 0 6 15ZM17.5 8.5l-11 6" /></>, copy: <path d="M9 8h10v12H9zM5 16H4V4h10v1" />, sparkle: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /> }; return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }
const duration = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const metric = (value, suffix = '') => (value == null ? 'Not available' : `${value}${suffix}`);

export default function VideoPlayer({ clip, clips, jobId, onSelect, onClose, onRename, onDelete, onCaption }) {
  const videoRef = useRef(null); const [time, setTime] = useState(0); const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [styles, setStyles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [captionError, setCaptionError] = useState(null);
  const [aspectMenuOpen, setAspectMenuOpen] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(null);
  const index = clips.findIndex((item) => item.id === clip.id); const previous = clips[index - 1]; const next = clips[index + 1];
  useEffect(() => { const onKey = (event) => { if (event.key === 'Escape') onClose(); if (event.key === 'ArrowLeft' && previous) onSelect(previous); if (event.key === 'ArrowRight' && next) onSelect(next); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [previous, next, onClose, onSelect]);
  useEffect(() => { setTime(0); setLoaded(false); }, [clip.id]);
  useEffect(() => { setPickerOpen(false); setBusy(false); setCaptionError(null); }, [clip.id]);
  useEffect(() => { getCaptionStyles().then(setStyles).catch(() => setStyles([])); }, []);

  const handleCaption = async (style) => {
    setBusy(true); setCaptionError(null);
    try {
      const result = await generateCaptions(jobId, clip.id, style);
      onCaption?.(clip.id, result);
      setPickerOpen(false);
    } catch (err) {
      setCaptionError(err.message || 'Could not generate captions.');
    } finally {
      setBusy(false);
    }
  };
  const share = async () => { try { await navigator.clipboard.writeText(getStaticUrl(clip.video_url)); } catch { } };
  return <div className="preview-overlay" onMouseDown={onClose}><section className="preview-workspace" onMouseDown={(event) => event.stopPropagation()}>
    <header className="preview-header"><div><span>Clipo {String(clip.id).padStart(2, '0')}</span><h2>{clip.title}</h2></div><div><a href={getDownloadUrl(jobId, clip.filename)} download aria-label="Download"><Icon name="download" /></a><button aria-label="Copy share link" onClick={share}><Icon name="copy" /></button><button aria-label="Fullscreen" onClick={() => videoRef.current?.requestFullscreen?.()}><Icon name="expand" /></button><button aria-label="Close preview" onClick={onClose}><Icon name="close" /></button></div></header>
    <div className="preview-layout">
      <main className="preview-stage">
        <div className="preview-video-wrap">
          {!loaded && <div className="preview-loader"><div className="spinner spinner-lg" /></div>}
          <video ref={videoRef} src={getStaticUrl(clip.video_url)} controls autoPlay className={loaded ? 'loaded' : ''} onLoadedData={() => setLoaded(true)} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
          <div className="preview-video-meta"><span>{duration(time)} / {duration(clip.duration)}</span><span>⏱ {duration(clip.duration)}</span><span>✦ AI selected</span></div>
        </div>
        <div className="preview-transcript"><div><p>Transcript</p><span>Transcript text is not available from the current API.</span></div><div className="preview-transcript-empty">Connect transcript data to enable live sentence highlighting and auto-scroll.</div></div>
      </main>
      <aside className="preview-sidebar">
        <div className="preview-insights"><p>AI clip insights</p><div><article><span>🔥 Hook strength</span><strong>{metric(clip.hook_strength, '/100')}</strong></article><article><span>⭐ AI quality score</span><strong>{metric(clip.quality_score, '/100')}</strong></article><article><span>🎯 Engagement prediction</span><strong>{clip.engagement_prediction || 'Not available'}</strong></article><article><span>⏱ Clip length</span><strong>{duration(clip.duration)}</strong></article></div></div>
        <div className="preview-actions">
          <p>Clip actions</p>
          <div className="preview-download-wrap">
            <div className="aspect-ratio-dropdown">
              <button className="aspect-ratio-button" onClick={() => setAspectMenuOpen((s) => !s)}>
                Aspect: {selectedAspectRatio || 'Default'}
              </button>
              {aspectMenuOpen && (
                <ul className="aspect-ratio-menu">
                  <li onClick={() => { setSelectedAspectRatio(null); setAspectMenuOpen(false); }}>Default</li>
                  <li onClick={() => { setSelectedAspectRatio('16:9'); setAspectMenuOpen(false); }}>16:9</li>
                  <li onClick={() => { setSelectedAspectRatio('9:16'); setAspectMenuOpen(false); }}>9:16</li>
                </ul>
              )}
            </div>
            <a href={getDownloadUrl(jobId, clip.filename) + (selectedAspectRatio ? `?aspect_ratio=${selectedAspectRatio}` : '')} download>
              <Icon name="download" /> Download
            </a>
          </div>
          <button disabled title="Transcript text is not provided by the current API"><Icon name="copy" /> Copy transcript</button>
          <button onClick={() => { const title = window.prompt('Rename clip', clip.title); if (title?.trim()) onRename(clip.id, title.trim()); }}>Rename</button>
          <div className="preview-caption">
            <button className={pickerOpen ? 'is-open' : ''} onClick={() => setPickerOpen((open) => !open)} disabled={busy}><Icon name="sparkle" /> {busy ? 'Burning captions…' : 'Generate captions'}</button>
            {pickerOpen && <div className="preview-caption-picker">{styles.length ? styles.map((style) => <button key={style.key} disabled={busy} onClick={() => handleCaption(style.key)}>{style.label}</button>) : <span className="preview-caption-empty">No styles available</span>}{captionError && <span className="preview-caption-error">{captionError}</span>}</div>}
          </div>
          <button className="preview-delete" onClick={() => onDelete(clip.id)}>Remove from view</button>
        </div>
      </aside>
    </div>
    <footer className="preview-related"><div><p>Related clips</p><small>← / → to switch · Esc to close</small></div><div>{clips.map((item) => <button className={item.id === clip.id ? 'active' : ''} key={item.id} onClick={() => onSelect(item)}><img src={getStaticUrl(item.thumbnail_url)} alt="" /><span>{duration(item.duration)}</span></button>)}</div></footer>
  </section></div>;
}
