import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getClips, getDownloadAllUrl, getDownloadUrl, getStaticUrl, generateCaptions } from '../lib/api';
import VideoPlayer from './VideoPlayer';
import CaptionStudio from './CaptionStudio';

const Icon = ({ type, className }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    download: <><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M4 20h16" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    play: <path d="m9 7 7 5-7 5V7Z" fill="currentColor" />,
    spark: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />,
    filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
    close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
    caption: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 12h3M14 12h3" /></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTotalRuntime = (seconds) => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
};

function StatCard({ label, value, sub }) {
  return (
    <motion.div
      className="results-stat"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <span className="results-stat-value">{value}</span>
      <span className="results-stat-label">{label}</span>
      {sub && <span className="results-stat-sub">{sub}</span>}
    </motion.div>
  );
}

function ClipCard({ clip, jobId, onPlay, onRename, onDelete, onStudio }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isCaptured = Boolean(clip.video_url && clip.video_url.includes('captioned_clip_'));


  return (
    <motion.article
      className="result-clip-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <button className="result-thumb" onClick={() => onPlay(clip)} type="button" aria-label={`Play ${clip.title}`}>
        <img src={getStaticUrl(clip.thumbnail_url)} alt={clip.title} onError={(event) => { event.currentTarget.style.opacity = 0; }} />
        <div className="result-thumb-shade" />
        <span className="result-duration">{formatDuration(clip.duration)}</span>
        <span className="result-selected"><i /> AI selected</span>
        {isCaptured && (
          <span className="result-captioned-badge">
            <Icon type="caption" />
            <span>Burned</span>
          </span>
        )}
        <span className="result-play"><Icon type="play" /></span>
      </button>
      <div className="result-card-copy">
        <div className="result-card-title">
          <h3 title={clip.title}>{clip.title}</h3>
          <button
            type="button"
            aria-label="Clip actions"
            className="result-more"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((open) => !open); }}
          >
            <Icon type="more" />
          </button>
        </div>
        <p className="result-preview">AI selected this moment from your source video.</p>
        <div className="result-tags">
          <span>✦ AI-picked moment</span>
          <span><Icon type="clock" className="result-tag-icon" /> {formatDuration(clip.duration)}</span>
        </div>
        <div className="result-card-actions">
          <button type="button" onClick={() => onPlay(clip)}>
            <Icon type="play" />
            <span>Preview</span>
          </button>
          <button type="button" className="result-studio-btn" onClick={() => onStudio(clip)}>
            <Icon type="caption" />
            <span>Studio</span>
          </button>
          <div className="result-card-actions-download">
            <a href={getDownloadUrl(jobId, clip.filename)} download>
              <Icon type="download" />
              <span>Download</span>
            </a>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="result-menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <button type="button" onClick={() => { const title = window.prompt('Rename clip', clip.title); if (title?.trim()) onRename(clip.id, title.trim()); setMenuOpen(false); }}>
                <Icon type="check" />
                <span>Rename</span>
              </button>
              <button type="button" disabled title="Transcript text is not provided by the current API">
                <Icon type="copy" />
                <span>Copy transcript</span>
              </button>
              <button type="button" className="danger" onClick={() => { onDelete(clip.id); setMenuOpen(false); }}>
                <Icon type="close" />
                <span>Remove</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export default function ResultsScreen({ jobId, onReset }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [feedbackPrompted, setFeedbackPrompted] = useState(false);
  const [playingClip, setPlayingClip] = useState(null);
  const [studioClip, setStudioClip] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [durationFilter, setDurationFilter] = useState('all');

  useEffect(() => {
    if (!jobId) return;
    getClips(jobId)
      .then((data) => { setClips(data || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [jobId]);

  // Keep backward-compatible: open modal when coming back from report route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === '/report') setShowReportModal(true);
  }, []);

  // When clips finish loading for the first time and there are clips,
  // show a small feedback toast prompting the user for feedback.
  useEffect(() => {
    if (!loading && clips.length > 0 && !feedbackPrompted) {
      setShowFeedbackToast(true);
      setFeedbackPrompted(true);
    }
  }, [loading, clips, feedbackPrompted]);

  const totalRuntime = useMemo(
    () => clips.reduce((sum, clip) => sum + (clip.duration || 0), 0),
    [clips]
  );

  const visibleClips = useMemo(() => {
    return clips
      .filter((clip) => (clip.title || '').toLowerCase().includes(query.toLowerCase()))
      .filter((clip) => durationFilter === 'all' || (durationFilter === 'short' ? clip.duration < 30 : clip.duration >= 30))
      .sort((a, b) => {
        if (sort === 'shortest') return a.duration - b.duration;
        if (sort === 'longest') return b.duration - a.duration;
        return b.id - a.id;
      });
  }, [clips, query, sort, durationFilter]);

  const counts = useMemo(() => {
    const c = { all: clips.length, short: 0, long: 0 };
    for (const clip of clips) {
      if ((clip.duration || 0) < 30) c.short += 1;
      else c.long += 1;
    }
    return c;
  }, [clips]);

  const renameClip = (id, title) =>
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, title } : clip));
  const removeClip = (id) => setClips((current) => current.filter((clip) => clip.id !== id));
  const captionClip = (id, result) =>
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, filename: result.filename, video_url: result.video_url } : clip));

  const handleStudioSave = async (options) => {
    if (!studioClip) return;
    const result = await generateCaptions(jobId, studioClip.id, options.preset);
    captionClip(studioClip.id, result);
    setStudioClip(null);
  };

  const downloadAll = () => {
    const link = document.createElement('a');
    link.href = getDownloadAllUrl(jobId);
    link.download = `clipo-clips-${jobId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const submitReport = async () => {
    try {
      await fetch(`/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, message: reportMessage }),
      });
    } catch (err) {
      // ignore errors for now
    }
    setReportMessage('');
    setShowReportModal(false);
    setShowFeedbackToast(false);
  };

  if (loading) {
    return (
      <div className="results-shell results-centered">
        <div className="spinner spinner-lg" />
        <p>Loading your Clipo clips</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-shell results-centered">
        <div className="results-error-icon">
          <Icon type="close" />
        </div>
        <p className="results-kicker">Something went wrong</p>
        <h1>Could not load your Clipo clips</h1>
        <p>{error}</p>
        <button className="results-primary" onClick={onReset}>
          <Icon type="refresh" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="results-shell">
      <div className="results-aura" />
      <div className="results-frame">
        <motion.header
          className="results-header"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="results-header-text">
            <div className="results-kicker">
              <Icon type="spark" />
              <span>Results</span>
            </div>
            <h1>Your clips are ready <span className="results-emoji">🎉</span></h1>
            <p>AI found the highest-performing moments from your video.</p>
          </div>
          <div className="results-header-actions">
            <motion.button
              className="results-quiet"
              onClick={downloadAll}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              disabled={!clips.length}
            >
              <Icon type="download" />
              <span>Download all</span>
            </motion.button>
            <motion.button
              className="results-primary"
              onClick={onReset}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon type="plus" />
              <span>New job</span>
            </motion.button>
            <motion.button
              className="results-quiet"
              onClick={() => setShowReportModal(true)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon type="close" />
              <span>Report issue</span>
            </motion.button>
          </div>
        </motion.header>

        {clips.length > 0 && (
          <motion.section
            className="results-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <StatCard label="Total clips" value={counts.all} sub={`${clips.length} ready to use`} />
            <StatCard label="Total runtime" value={formatTotalRuntime(totalRuntime)} sub="across all clips" />
            <StatCard label="Short (< 30s)" value={counts.short} sub="perfect for socials" />
            <StatCard label="Long (30s+)" value={counts.long} sub="in-depth cuts" />
          </motion.section>
        )}

        {clips.length > 0 && (
          <motion.section
            className="results-toolbar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <label className="results-search">
              <Icon type="search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clips"
                aria-label="Search clips"
              />
              {query && (
                <button
                  type="button"
                  className="results-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <Icon type="close" />
                </button>
              )}
            </label>
            <div className="results-select-wrap">
              <Icon type="filter" />
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort clips">
                <option value="newest">Newest first</option>
                <option value="shortest">Shortest</option>
                <option value="longest">Longest</option>
                <option value="score" disabled>Highest score — unavailable</option>
              </select>
            </div>
            <div className="results-filter" role="tablist" aria-label="Duration filter">
              <button
                type="button"
                className={durationFilter === 'all' ? 'is-active' : ''}
                onClick={() => setDurationFilter('all')}
                aria-pressed={durationFilter === 'all'}
              >
                All
              </button>
              <button
                type="button"
                className={durationFilter === 'short' ? 'is-active' : ''}
                onClick={() => setDurationFilter('short')}
                aria-pressed={durationFilter === 'short'}
              >
                Under 30s
              </button>
              <button
                type="button"
                className={durationFilter === 'long' ? 'is-active' : ''}
                onClick={() => setDurationFilter('long')}
                aria-pressed={durationFilter === 'long'}
              >
                30s+
              </button>
            </div>
          </motion.section>
        )}

        {visibleClips.length > 0 ? (
          <motion.section
            className="results-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <AnimatePresence mode="popLayout">
              {visibleClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  jobId={jobId}
                  onPlay={setPlayingClip}
                  onRename={renameClip}
                  onDelete={removeClip}
                  onStudio={setStudioClip}
                />
              ))}
            </AnimatePresence>
          </motion.section>
        ) : (
          <motion.section
            className="results-empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="results-empty-icon"><Icon type="spark" /></div>
            <h2>{clips.length ? 'No clips match those filters' : 'Generate your first clips'}</h2>
            <p>
              {clips.length
                ? 'Try clearing the search or switching the duration filter.'
                : 'Your best Clipo moments will appear here once processing finishes.'}
            </p>
            {clips.length ? (
              <button
                type="button"
                className="results-quiet"
                onClick={() => { setQuery(''); setDurationFilter('all'); }}
              >
                Clear filters
              </button>
            ) : (
              <button type="button" className="results-primary" onClick={onReset}>
                <Icon type="plus" />
                <span>Start a new job</span>
              </button>
            )}
          </motion.section>
        )}
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {showFeedbackToast && (
          <motion.div className="feedback-toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div>
              <strong>How did this job go?</strong>
              <p>Quick feedback helps us improve results.</p>
            </div>
            <div className="feedback-actions">
              <button className="results-primary" onClick={() => setShowFeedbackToast(false)}>Looks good</button>
              <button className="results-quiet" onClick={() => { setShowReportModal(true); setShowFeedbackToast(false); }}>Report issue</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div className="report-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="report-modal" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }}>
              <h3>Report an issue</h3>
              <textarea value={reportMessage} onChange={(e) => setReportMessage(e.target.value)} placeholder="Describe the problem or suggestion" />
              <div className="report-actions">
                <button className="results-quiet" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="results-primary" onClick={submitReport}>Send report</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playingClip && (
          <VideoPlayer
            clip={playingClip}
            clips={clips}
            jobId={jobId}
            onSelect={setPlayingClip}
            onClose={() => setPlayingClip(null)}
            onRename={renameClip}
            onDelete={(id) => { removeClip(id); setPlayingClip(null); }}
            onCaption={captionClip}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {studioClip && (
          <CaptionStudio
            clip={studioClip}
            onClose={() => setStudioClip(null)}
            onSave={handleStudioSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}