import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/auth';
import { updateProfile, getUserStats } from '../lib/api';
import StudioHeader from './StudioHeader';

const MAX_BIO = 300;
const MAX_NAME = 60;

function CountUp({ value, suffix = '', duration = 0.8 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const numeric = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const isInt = Number.isInteger(numeric) && !String(value).includes('.');

  useEffect(() => {
    const start = prev.current;
    if (start === numeric) {
      setDisplay(numeric);
      return;
    }
    const startTime = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (numeric - start) * eased;
      setDisplay(current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else prev.current = numeric;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric, duration]);

  const formatted = isInt ? Math.round(display) : display.toFixed(1);
  return <>{formatted}{suffix}</>;
}

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const ScissorsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const JobsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const StorageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const SignOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
  </svg>
);

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function ProfileScreen({ onNavigate }) {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    getUserStats()
      .then((s) => { setStats(s); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!user) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-aura" />
        <div className="dashboard-frame">
          <StudioHeader activeTab="profile" onNavigate={onNavigate} />
          <main><div className="profile-shell"><p className="profile-empty">Not signed in.</p></div></main>
        </div>
      </div>
    );
  }

  function startEdit() {
    setDisplayName(user.display_name || user.name || '');
    setBio(user.bio || '');
    setSaveError('');
    setEditing(true);
  }

  async function handleSave() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setSaveError('Display name cannot be empty');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateProfile({ display_name: trimmedName, bio });
      const next = updated && typeof updated === 'object' ? updated : { ...user, display_name: trimmedName, bio };
      setUser(next);
      setEditing(false);
      setToast({ type: 'success', message: 'Profile saved successfully' });
    } catch (err) {
      setSaveError(err?.message || 'Could not save profile');
    }
    setSaving(false);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError('');
  }

  function copyEmail() {
    if (!user?.email) return;
    navigator.clipboard?.writeText(user.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  const name = user.display_name || user.name || 'User';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const bioLength = bio.length;
  const bioPct = Math.min(100, (bioLength / MAX_BIO) * 100);

  const statsList = [
    { key: 'videos', label: 'Videos processed', value: stats?.completed_jobs, suffix: '', Icon: VideoIcon, tone: 'violet' },
    { key: 'clips', label: 'Clips generated', value: stats?.total_clips, suffix: '', Icon: ScissorsIcon, tone: 'pink' },
    { key: 'jobs', label: 'Total jobs', value: stats?.total_jobs, suffix: '', Icon: JobsIcon, tone: 'cyan' },
    { key: 'storage', label: 'Storage used', value: stats?.storage_mb, suffix: ' MB', Icon: StorageIcon, tone: 'amber' },
  ];

  return (
    <div className="dashboard-shell">
      <div className="dashboard-aura" />
      <div className="dashboard-frame">
        <StudioHeader activeTab="profile" onNavigate={onNavigate} />
        <main>
          <div className="profile-shell">
            <motion.section
              className="profile-card"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="profile-avatar-wrap">
                <motion.div
                  className="profile-avatar"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  {user.picture ? (
                    <img src={user.picture} alt={name} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="profile-avatar-initials">{initials}</span>
                  )}
                  <span className="profile-avatar-ring" aria-hidden="true" />
                </motion.div>
              </div>
              <div className="profile-info">
                <h1>{name}</h1>
                <button
                  type="button"
                  className={`profile-email ${copied ? 'is-copied' : ''}`}
                  onClick={copyEmail}
                  aria-label={`Copy email ${user.email}`}
                >
                  <MailIcon />
                  <span>{user.email}</span>
                  <span className="profile-copy-hint" aria-live="polite">
                    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                  </span>
                </button>
                {user.bio && !editing && (
                  <motion.p
                    className="profile-bio"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {user.bio}
                  </motion.p>
                )}
                {user.created_at && (
                  <p className="profile-joined">
                    <CalendarIcon />
                    <span>Joined {new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                  </p>
                )}
              </div>
            </motion.section>

            <motion.section
              className="profile-section"
              custom={1}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="profile-section-header">
                <h2>
                  <SparkleIcon />
                  <span>Profile details</span>
                </h2>
                {!editing && (
                  <motion.button
                    className="ghost-button profile-edit-toggle"
                    onClick={startEdit}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <EditIcon />
                    <span>Edit</span>
                  </motion.button>
                )}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.div
                    key="edit"
                    className="profile-edit-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <label className={!displayName.trim() ? 'has-error' : ''}>
                      <span className="profile-label-row">
                        <span>Display Name</span>
                        <span className="profile-counter">{displayName.length}/{MAX_NAME}</span>
                      </span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value.slice(0, MAX_NAME))}
                        maxLength={MAX_NAME}
                        placeholder="How should we call you?"
                        autoFocus
                      />
                    </label>
                    <label>
                      <span className="profile-label-row">
                        <span>Bio</span>
                        <span className={`profile-counter ${bioPct > 90 ? 'is-warn' : ''}`}>{bioLength}/{MAX_BIO}</span>
                      </span>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
                        maxLength={MAX_BIO}
                        rows={3}
                        placeholder="Tell us about yourself..."
                      />
                      <div className="profile-progress" aria-hidden="true">
                        <motion.span
                          className="profile-progress-bar"
                          animate={{ width: `${bioPct}%` }}
                          transition={{ duration: 0.25 }}
                        />
                      </div>
                    </label>
                    {saveError && (
                      <motion.p
                        className="profile-error"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {saveError}
                      </motion.p>
                    )}
                    <div className="profile-edit-actions">
                      <motion.button
                        className="generate-button"
                        onClick={handleSave}
                        disabled={saving || !displayName.trim()}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {saving ? (
                          <>
                            <span className="spinner" />
                            <span>Saving…</span>
                          </>
                        ) : (
                          <>
                            <CheckIcon />
                            <span>Save changes</span>
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        className="profile-cancel"
                        onClick={cancelEdit}
                        disabled={saving}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <XIcon />
                        <span>Cancel</span>
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.dl
                    key="view"
                    className="profile-detail-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div>
                      <dt>Display name</dt>
                      <dd>{name}</dd>
                    </div>
                    <div>
                      <dt>Bio</dt>
                      <dd className={user.bio ? '' : 'profile-empty-value'}>
                        {user.bio || 'Add a short bio to personalize your profile.'}
                      </dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd className="profile-mono">{user.email}</dd>
                    </div>
                  </motion.dl>
                )}
              </AnimatePresence>
            </motion.section>

            <motion.section
              className="profile-section"
              custom={2}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="profile-section-header">
                <h2>Usage</h2>
                {stats && !statsLoading && (
                  <span className="profile-section-tag" aria-live="polite">Live</span>
                )}
              </div>
              <div className="profile-stats">
                {statsList.map(({ key, label, value, suffix, Icon, tone }, i) => (
                  <motion.div
                    key={key}
                    className={`profile-stat tone-${tone}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="profile-stat-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="profile-stat-value">
                      {statsLoading || value == null ? (
                        <span className="profile-stat-skeleton" aria-label="Loading" />
                      ) : (
                        <CountUp value={value} suffix={suffix} />
                      )}
                    </span>
                    <span className="profile-stat-label">{label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.section
              className="profile-section"
              custom={3}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="profile-section-header">
                <h2>Account</h2>
              </div>
              <div className="profile-account-info">
                <div className="profile-account-row">
                  <span>Connected as</span>
                  <span>{user.email}</span>
                </div>
                <div className="profile-account-row">
                  <span>Authentication</span>
                  <span>Google OAuth</span>
                </div>
                {user.created_at && (
                  <div className="profile-account-row">
                    <span>Member since</span>
                    <span>{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <div className="profile-actions">
                <motion.button
                  className="profile-signout-button"
                  onClick={logout}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <SignOutIcon />
                  <span>Sign out</span>
                </motion.button>
              </div>
            </motion.section>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            className={`profile-toast profile-toast-${toast.type}`}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            role="status"
          >
            {toast.type === 'success' && <CheckIcon />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}