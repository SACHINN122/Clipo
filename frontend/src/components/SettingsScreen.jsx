import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getConfig } from '../lib/api';
import StudioHeader from './StudioHeader';

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
  </svg>
);

const CpuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const HardDriveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="12" x2="2" y2="12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    <line x1="6" y1="16" x2="6.01" y2="16" />
    <line x1="10" y1="16" x2="10.01" y2="16" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const WifiIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

function StatusPill({ status = 'ok', children }) {
  const tone = {
    ok: { bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.3)', color: '#34d399', Icon: CheckIcon },
    warn: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', Icon: InfoIcon },
    err: { bg: 'rgba(224, 108, 119, 0.1)', border: 'rgba(224, 108, 119, 0.3)', color: '#fb7185', Icon: XIcon },
  }[status] || {};
  if (!tone) return children;
  const { bg, border, color, Icon } = tone;
  return (
    <span className="settings-pill" style={{ background: bg, borderColor: border, color }}>
      <Icon />
      <span>{children}</span>
    </span>
  );
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

function useLocalStats() {
  const [stats, setStats] = useState({ storage: null, itemCount: null, online: true, lastSaved: null, supports: { webrtc: false, webgl: false } });
  useEffect(() => {
    const update = () => {
      let storage = null;
      let itemCount = 0;
      try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key) || '';
          total += key.length + value.length;
          itemCount += 1;
        }
        storage = total * 2;
      } catch {}
      setStats({
        storage,
        itemCount,
        online: navigator.onLine,
        lastSaved: localStorage.getItem('clipo_last_saved') || null,
        supports: {
          webrtc: typeof RTCPeerConnection !== 'undefined',
          webgl: (() => {
            try {
              const c = document.createElement('canvas');
              return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
            } catch { return false; }
          })(),
        },
      });
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return stats;
}

function Row({ label, value, children, mono = false }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <span className={`settings-row-value ${mono ? 'is-mono' : ''}`}>
        {children ?? value}
      </span>
    </div>
  );
}

function Card({ index = 0, icon: Icon, title, badge, children }) {
  return (
    <motion.section
      className="settings-card"
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <header className="settings-card-header">
        <span className="settings-card-icon">
          <Icon />
        </span>
        <h2>{title}</h2>
        {badge}
      </header>
      <div className="settings-card-body">{children}</div>
    </motion.section>
  );
}

export default function SettingsScreen({ onNavigate }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const local = useLocalStats();

  async function load() {
    setError(null);
    try {
      const cfg = await getConfig();
      if (!cfg) {
        setError('Backend unreachable');
      } else {
        setConfig(cfg);
      }
    } catch (e) {
      setError(e?.message || 'Could not load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  function refresh() {
    setRefreshing(true);
    setLoading(true);
    load();
  }

  const provider = config?.ai_provider || 'none';
  const providerStatus = provider === 'none' ? 'err' : 'ok';
  const geminiStatus = config?.gemini_configured ? 'ok' : 'warn';
  const nvidiaStatus = config?.nvidia_configured ? 'ok' : 'warn';

  return (
    <div className="dashboard-shell">
      <div className="dashboard-aura" />
      <div className="dashboard-frame">
        <StudioHeader activeTab="settings" onNavigate={onNavigate} rightSlot={
          <button className="icon-button" aria-label="Close" onClick={() => onNavigate?.('create')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        } />
        <main>
          <div className="settings-shell">
            <motion.header
              className="settings-header"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="eyebrow">
                <SparkleIcon />
                <span>Settings</span>
              </div>
              <h1>Application settings</h1>
              <p>View your system configuration and AI provider status.</p>
              <div className="settings-header-actions">
                <motion.button
                  className="ghost-button"
                  onClick={refresh}
                  disabled={loading}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  aria-label="Refresh settings"
                >
                  <RefreshIcon />
                  <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
                </motion.button>
              </div>
            </motion.header>

            <AnimatePresence mode="wait">
              {loading && !config ? (
                <motion.div
                  key="skeleton"
                  className="settings-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="settings-card settings-card-skeleton">
                      <div className="settings-skel-bar" style={{ width: '40%' }} />
                      <div className="settings-skel-bar" style={{ width: '70%' }} />
                      <div className="settings-skel-bar" style={{ width: '55%' }} />
                      <div className="settings-skel-bar" style={{ width: '65%' }} />
                    </div>
                  ))}
                </motion.div>
              ) : error && !config ? (
                <motion.div
                  key="error"
                  className="settings-error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="settings-error-icon">
                    <XIcon />
                  </div>
                  <h3>Could not load settings</h3>
                  <p>{error}. The backend may not be running.</p>
                  <motion.button
                    className="generate-button"
                    onClick={refresh}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <RefreshIcon />
                    <span>Try again</span>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  className="settings-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    index={0}
                    icon={CpuIcon}
                    title="AI Provider"
                    badge={<StatusPill status={providerStatus}>{provider === 'none' ? 'Not configured' : 'Ready'}</StatusPill>}
                  >
                    <Row label="Active provider">
                      <span className="settings-provider-name">
                        {provider === 'nvidia' && 'NVIDIA NIM'}
                        {provider === 'gemini' && 'Google Gemini'}
                        {provider === 'none' && 'None'}
                      </span>
                    </Row>
                    <Row label="NVIDIA NIM">
                      <StatusPill status={nvidiaStatus}>
                        {config?.nvidia_configured ? 'Configured' : 'Missing key'}
                      </StatusPill>
                    </Row>
                    <Row label="Google Gemini">
                      <StatusPill status={geminiStatus}>
                        {config?.gemini_configured ? 'Configured' : 'Missing key'}
                      </StatusPill>
                    </Row>
                    {config?.gemini_model && (
                      <Row label="Gemini model" value={config.gemini_model} mono />
                    )}
                    {config?.nvidia_model && (
                      <Row label="NVIDIA model" value={config.nvidia_model} mono />
                    )}
                  </Card>

                  <Card
                    index={1}
                    icon={ServerIcon}
                    title="Processing"
                  >
                    <Row label="Processing mode">
                      <StatusPill status="ok">Local-first</StatusPill>
                    </Row>
                    <Row label="AI inference">
                      <span>{provider === 'none' ? 'Disabled' : 'Server-side'}</span>
                    </Row>
                    <Row label="Network">
                      <span className={`settings-conn ${local.online ? 'is-online' : 'is-offline'}`}>
                        <WifiIcon />
                        <span>{local.online ? 'Online' : 'Offline'}</span>
                      </span>
                    </Row>
                  </Card>

                  <Card
                    index={2}
                    icon={HardDriveIcon}
                    title="Uploads & Clips"
                  >
                    <Row label="Max upload size" value={config?.max_upload_gb ? `${config.max_upload_gb} GB` : '5 GB'} />
                    <Row label="Min clip length" value={formatDuration(config?.min_clip_duration)} />
                    <Row label="Max clip length" value={formatDuration(config?.max_clip_duration)} />
                    <Row label="YouTube max">
                      {config?.max_youtube_duration_s
                        ? formatDuration(config.max_youtube_duration_s)
                        : '—'}
                    </Row>
                  </Card>

                  <Card
                    index={3}
                    icon={DatabaseIcon}
                    title="Local data"
                    badge={<StatusPill status="ok">Browser</StatusPill>}
                  >
                    <Row label="Storage">
                      <span className="is-mono">{formatBytes(local.storage)}</span>
                    </Row>
                    <Row label="Stored items" value={local.itemCount == null ? '—' : local.itemCount} />
                    <Row label="Browser features">
                      <span className="settings-feature-list">
                        <span className={`settings-feature ${local.supports.webgl ? 'is-on' : 'is-off'}`}>
                          <VideoIcon /> WebGL
                        </span>
                        <span className={`settings-feature ${local.supports.webrtc ? 'is-on' : 'is-off'}`}>
                          <GlobeIcon /> RTC
                        </span>
                      </span>
                    </Row>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}