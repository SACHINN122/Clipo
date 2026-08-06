import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StudioHeader from './StudioHeader';

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

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  if (day < 365) return `${Math.floor(day / 30)}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

function groupBucket(iso) {
  if (!iso) return 'Older';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return 'This week';
  if (diffDays < 30) return 'This month';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="11" height="11">
    <circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" />
  </svg>
);

const StatCard = ({ label, value, sub }) => (
  <motion.div
    className="library-stat"
    whileHover={{ y: -2 }}
    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
  >
    <span className="library-stat-value">{value}</span>
    <span className="library-stat-label">{label}</span>
    {sub && <span className="library-stat-sub">{sub}</span>}
  </motion.div>
);

function JobCard({ job, onVisitJob, onRemove, index = 0 }) {
  const isYouTube = job.sourceType === 'youtube';
  const rel = relativeTime(job.createdAt);
  return (
    <motion.div
      className="job-history-item"
      onClick={() => onVisitJob?.(job.jobId, job)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      layout
    >
      <div className={`job-history-icon ${isYouTube ? 'is-youtube' : 'is-file'}`}>
        {isYouTube ? <YouTubeIcon /> : <FileIcon />}
      </div>
      <div className="job-history-info">
        <strong title={job.videoName}>{job.videoName}</strong>
        <span className="job-history-meta">
          <span className="job-history-time" title={formatJobTime(job.createdAt)}>
            <ClockIcon />
            <span>{rel || formatJobTime(job.createdAt)}</span>
          </span>
          <span className={`job-history-source ${isYouTube ? 'is-youtube' : 'is-file'}`}>
            {isYouTube ? 'YouTube' : 'Upload'}
          </span>
        </span>
      </div>
      <span className="job-history-id">{job.jobId?.slice(0, 8)}</span>
      <button
        type="button"
        className="job-history-remove"
        aria-label={`Remove ${job.videoName} from history`}
        onClick={(e) => { e.stopPropagation(); onRemove?.(job.jobId); }}
      >
        <CloseIcon />
      </button>
      <span className="job-history-arrow" aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </motion.div>
  );
}

function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="library-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="library-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>{title}</h3>
            <p>{body}</p>
            <div className="library-modal-actions">
              <motion.button
                className="ghost-button"
                onClick={onCancel}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                className={danger ? 'library-danger-button' : 'generate-button'}
                onClick={onConfirm}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                autoFocus
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LibraryScreen({ onNavigate, onVisitJob }) {
  const [jobHistory, setJobHistory] = useState(loadJobHistory);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'file' | 'youtube'
  const [sort, setSort] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  // Re-read when window regains focus (e.g. user finishes a job and returns)
  useEffect(() => {
    const onFocus = () => setJobHistory(loadJobHistory());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const filtered = useMemo(() => {
    let list = jobHistory.slice();
    if (sourceFilter !== 'all') {
      list = list.filter((j) => (j.sourceType || 'file') === sourceFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((j) =>
        (j.videoName || '').toLowerCase().includes(q) ||
        (j.jobId || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sort === 'name') return (a.videoName || '').localeCompare(b.videoName || '');
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [jobHistory, query, sourceFilter, sort]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const job of filtered) {
      const key = groupBucket(job.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(job);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, jobs: map.get(g) }));
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: jobHistory.length, file: 0, youtube: 0 };
    for (const j of jobHistory) {
      if ((j.sourceType || 'file') === 'youtube') c.youtube += 1;
      else c.file += 1;
    }
    return c;
  }, [jobHistory]);

  const lastUsed = jobHistory[0]?.createdAt ? relativeTime(jobHistory[0].createdAt) : null;

  function update(next) {
    setJobHistory(next);
    saveJobHistory(next);
  }

  function clearAll() {
    setConfirmClear(false);
    update([]);
  }

  function removeJob(id) {
    update(jobHistory.filter((j) => j.jobId !== id));
    setPendingRemove(null);
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-aura" />
      <div className="dashboard-frame">
        <StudioHeader activeTab="library" onNavigate={onNavigate} />
        <main>
          <div className="library-shell">
            <motion.header
              className="library-header"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="library-header-text">
                <div className="eyebrow">
                  <SparkleIcon />
                  <span>Library</span>
                </div>
                <h1>Your projects</h1>
                <p>All your processed videos and clips in one place.</p>
              </div>
              <div className="library-header-actions">
                <motion.button
                  className="generate-button library-new-button"
                  onClick={() => onNavigate?.('create')}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <PlusIcon />
                  <span>New project</span>
                </motion.button>
              </div>
            </motion.header>

            {jobHistory.length > 0 && (
              <motion.div
                className="library-stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <StatCard label="Total projects" value={counts.all} />
                <StatCard label="Uploaded videos" value={counts.file} />
                <StatCard label="YouTube imports" value={counts.youtube} />
                <StatCard
                  label="Last activity"
                  value={lastUsed || '—'}
                  sub={lastUsed ? 'since you started' : 'no recent jobs'}
                />
              </motion.div>
            )}

            {jobHistory.length > 0 && (
              <motion.div
                className="library-toolbar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.35 }}
              >
                <label className="library-search">
                  <SearchIcon />
                  <input
                    type="search"
                    placeholder="Search by name or job ID…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search projects"
                  />
                  {query && (
                    <button
                      type="button"
                      className="library-search-clear"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </label>
                <div className="library-filter-group" role="tablist" aria-label="Source filter">
                  <button
                    className={sourceFilter === 'all' ? 'is-active' : ''}
                    onClick={() => setSourceFilter('all')}
                    aria-pressed={sourceFilter === 'all'}
                  >
                    All
                  </button>
                  <button
                    className={sourceFilter === 'file' ? 'is-active' : ''}
                    onClick={() => setSourceFilter('file')}
                    aria-pressed={sourceFilter === 'file'}
                  >
                    Uploads
                  </button>
                  <button
                    className={sourceFilter === 'youtube' ? 'is-active' : ''}
                    onClick={() => setSourceFilter('youtube')}
                    aria-pressed={sourceFilter === 'youtube'}
                  >
                    YouTube
                  </button>
                </div>
                <label className="library-sort">
                  <FilterIcon />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </label>
                <motion.button
                  className="ghost-button library-clear-button"
                  onClick={() => setConfirmClear(true)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <TrashIcon />
                  <span>Clear all</span>
                </motion.button>
              </motion.div>
            )}

            {jobHistory.length === 0 ? (
              <motion.div
                className="empty-jobs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <div className="empty-art"><i /><i /><i /><b><SparkleIcon /></b></div>
                <h3>No projects yet</h3>
                <p>Your recent projects will appear here, ready to preview, revisit and export.</p>
                <motion.button
                  className="generate-button"
                  onClick={() => onNavigate?.('create')}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <PlusIcon />
                  <span>Start a new job</span>
                </motion.button>
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div
                className="empty-jobs library-no-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="library-no-results-icon"><SearchIcon /></div>
                <h3>No projects match</h3>
                <p>Try a different search or remove some filters.</p>
                <motion.button
                  className="ghost-button"
                  onClick={() => { setQuery(''); setSourceFilter('all'); }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Reset filters
                </motion.button>
              </motion.div>
            ) : (
              <div className="library-results">
                <AnimatePresence mode="popLayout">
                  {grouped.map((group) => (
                    <motion.section
                      key={group.label}
                      className="library-group"
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <header className="library-group-header">
                        <h3>{group.label}</h3>
                        <span className="library-group-count">{group.jobs.length}</span>
                      </header>
                      <div className="job-history-list">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {group.jobs.map((job, i) => (
                            <JobCard
                              key={job.jobId}
                              job={job}
                              index={i}
                              onVisitJob={onVisitJob}
                              onRemove={(id) => setPendingRemove(id)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.section>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all projects?"
        body={`This will remove ${jobHistory.length} project${jobHistory.length === 1 ? '' : 's'} from your library. The original files on the server are unaffected.`}
        confirmLabel="Clear all"
        cancelLabel="Keep"
        danger
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove this project?"
        body="It will be hidden from your library. The original files remain on the server."
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onConfirm={() => removeJob(pendingRemove)}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}