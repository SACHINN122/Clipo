import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStaticUrl } from '../lib/api';

const PRESETS = [
  {
    id: 'classic',
    name: 'Classic',
    badge: '#1',
    blurb: 'Bold white with a soft drop shadow.',
    sample: 'THIS IS A HOOK',
    style: { font: 900, transform: 'uppercase', color: '#ffffff', shadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.4)', size: 22 },
  },
  {
    id: 'neon',
    name: 'Neon',
    badge: '#2',
    blurb: 'Yellow with a glowing aura.',
    sample: 'WATCH TILL THE END',
    style: { font: 900, transform: 'uppercase', color: '#facc15', shadow: '0 0 16px rgba(250, 204, 21, 0.6), 0 4px 8px rgba(0,0,0,0.6)', size: 24 },
  },
  {
    id: 'bold',
    name: 'Bold',
    blurb: 'Heavy weight, tight tracking, white.',
    sample: 'NO CAP. THIS HIT.',
    style: { font: 900, transform: 'uppercase', color: '#ffffff', shadow: '0 6px 16px rgba(0,0,0,0.9), 0 3px 0 #000', size: 26, letterSpacing: '-0.02em' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Soft pill background, clean and quiet.',
    sample: 'Here is the takeaway',
    style: { font: 500, transform: 'none', color: '#ffffff', bg: 'rgba(0,0,0,0.7)', padding: '6px 14px', radius: 8, size: 17, backdrop: true },
  },
];

const ANIMATIONS = [
  { id: 'none',     name: 'None',       icon: '·',         blurb: 'Static. No motion.' },
  { id: 'pop',      name: 'Pop In',     icon: 'P',         blurb: 'Quick scale + fade on each word.' },
  { id: 'slide',    name: 'Slide Up',   icon: '↑',         blurb: 'Slides up from below.' },
  { id: 'bounce',   name: 'Bounce',     icon: 'B',         blurb: 'Subtle bounce on every word.' },
  { id: 'typewriter', name: 'Typewriter', icon: 'T',        blurb: 'Words appear letter-by-letter.' },
  { id: 'shake',    name: 'Shake',      icon: 'S',         blurb: 'Emphasis shake on hot words.' },
];

const POSITIONS = [
  { id: 'top',    label: 'Top',    y: 18 },
  { id: 'center', label: 'Center', y: 50 },
  { id: 'bottom', label: 'Bottom', y: 82 },
];

const FONT_FAMILIES = [
  { id: 'outfit', name: 'Outfit (Modern)' },
  { id: 'inter',  name: 'Inter (Clean)' },
  { id: 'komika', name: 'Komika (Comic)' },
  { id: 'mono',   name: 'Mono (Tech)' },
];

const COLOR_PRESETS = ['#ffffff', '#facc15', '#34d399', '#f472b6', '#67e8f9', '#fb923c'];

const TABS = [
  { id: 'presets',    label: 'Presets',    icon: 'spark' },
  { id: 'adjust',     label: 'Adjust',     icon: 'sliders' },
  { id: 'animations', label: 'Animations', icon: 'play' },
];

const Icon = ({ type, className }) => {
  const paths = {
    close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    spark: <path d="m12 3 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />,
    sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    play: <polygon points="6 4 20 12 6 20 6 4" />,
    check: <polyline points="20 6 9 17 4 12" />,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  };
  return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.spark}</svg>;
};

function CaptionSample({ preset, animated = false, size = 'sm', animation = 'none' }) {
  const p = PRESETS.find((x) => x.id === preset) || PRESETS[0];
  const s = p.style;
  const sampleText = animated ? 'Your caption here' : p.sample;
  const animClass = animated ? `caption-anim-${animation}` : '';
  return (
    <span
      className={`caption-sample caption-sample-${size} ${animClass}`}
      style={{
        fontWeight: s.font,
        textTransform: s.transform,
        color: s.color,
        fontSize: `${size === 'lg' ? s.size : Math.max(11, s.size - 7)}px`,
        textShadow: s.shadow,
        background: s.bg,
        padding: size === 'lg' ? s.padding : (s.bg ? '3px 8px' : '0'),
        borderRadius: size === 'lg' ? s.radius : 4,
        backdropFilter: size === 'lg' && s.backdrop ? 'blur(8px)' : undefined,
        WebkitBackdropFilter: size === 'lg' && s.backdrop ? 'blur(8px)' : undefined,
        letterSpacing: s.letterSpacing,
        fontFamily: s.font === 900 ? 'var(--font-sans)' : 'var(--font-sans)',
      }}
    >
      {sampleText}
    </span>
  );
}

export default function CaptionStudio({ clip, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('presets');
  const [activePreset, setActivePreset] = useState('classic');
  const [position, setPosition] = useState('bottom');
  const [animation, setAnimation] = useState('none');
  const [font, setFont] = useState('outfit');
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(100);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const idx = TABS.findIndex((t) => t.id === activeTab);
        const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
        setActiveTab(TABS[next].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.resolve(onSave?.({ preset: activePreset, position, animation, font, color, size }));
      setToast({ type: 'success', message: 'Captions burned successfully' });
      setTimeout(() => onClose?.(), 600);
    } catch {
      setToast({ type: 'error', message: 'Could not burn captions' });
    } finally {
      setSaving(false);
    }
  };

  const activePresetData = useMemo(
    () => PRESETS.find((p) => p.id === activePreset) || PRESETS[0],
    [activePreset]
  );

  return (
    <div className="caption-studio-overlay" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Caption Studio">
      <motion.div
        ref={dialogRef}
        className="caption-studio"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="caption-studio-header">
          <div className="caption-studio-title">
            <span className="caption-studio-icon"><Icon type="spark" /></span>
            <div>
              <h3>Advanced Caption Studio</h3>
              <p>Style &amp; Placement</p>
            </div>
          </div>
          <button className="caption-studio-close" onClick={onClose} type="button" aria-label="Close caption studio">
            <Icon type="close" />
          </button>
        </header>

        <div className="caption-studio-body">
          {/* LEFT: controls */}
          <div className="caption-studio-controls">
            <nav className="caption-studio-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`caption-studio-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <Icon type={tab.icon} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="caption-studio-panel" role="tabpanel">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'presets' && (
                    <div className="caption-presets">
                      <div className="caption-panel-heading">
                        <span>Choose a preset</span>
                        <span className="caption-panel-tag">{PRESETS.length} styles</span>
                      </div>
                      <div className="caption-preset-grid">
                        {PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={`caption-preset-card ${activePreset === preset.id ? 'is-active' : ''}`}
                            onClick={() => setActivePreset(preset.id)}
                            aria-pressed={activePreset === preset.id}
                          >
                            <div className={`caption-preset-preview bg-${preset.id}`}>
                              <CaptionSample preset={preset.id} />
                              {preset.badge && <span className="caption-preset-badge">{preset.badge}</span>}
                              {activePreset === preset.id && (
                                <span className="caption-preset-check"><Icon type="check" /></span>
                              )}
                            </div>
                            <div className="caption-preset-meta">
                              <strong>{preset.name}</strong>
                              <span>{preset.blurb}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'adjust' && (
                    <div className="caption-adjust">
                      <div>
                        <div className="caption-panel-heading">
                          <span>Snap anchor</span>
                          <span className="caption-panel-tag">3 positions</span>
                        </div>
                        <div className="caption-anchor-row">
                          <div className="caption-anchor-grid">
                            {POSITIONS.map((pos) => (
                              <button
                                key={pos.id}
                                type="button"
                                className={`caption-anchor-cell ${position === pos.id ? 'is-active' : ''}`}
                                onClick={() => setPosition(pos.id)}
                                aria-pressed={position === pos.id}
                              >
                                <span className="caption-anchor-dot" />
                                <span className="caption-anchor-label">{pos.label}</span>
                              </button>
                            ))}
                          </div>
                          <p className="caption-anchor-help">
                            Pick where to snap captions, or <strong>drag them freely</strong> on the preview.
                          </p>
                        </div>
                      </div>

                      <div className="caption-adjust-grid">
                        <div className="caption-control">
                          <label htmlFor="caption-font">Font family</label>
                          <select id="caption-font" value={font} onChange={(e) => setFont(e.target.value)}>
                            {FONT_FAMILIES.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="caption-control">
                          <label>Text color</label>
                          <div className="caption-color-row">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => setColor(e.target.value)}
                              aria-label="Custom text color"
                            />
                            <div className="caption-color-presets">
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`caption-color-swatch ${color.toLowerCase() === c ? 'is-active' : ''}`}
                                  style={{ background: c }}
                                  onClick={() => setColor(c)}
                                  aria-label={`Use color ${c}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="caption-control caption-control-wide">
                          <div className="caption-control-label-row">
                            <label htmlFor="caption-size">Size</label>
                            <span className="caption-control-value">{size}%</span>
                          </div>
                          <input
                            id="caption-size"
                            type="range"
                            min="60"
                            max="160"
                            step="5"
                            value={size}
                            onChange={(e) => setSize(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'animations' && (
                    <div className="caption-animations">
                      <div className="caption-panel-heading">
                        <span>Word animations</span>
                        <span className="caption-panel-tag">{ANIMATIONS.length} options</span>
                      </div>
                      <div className="caption-animation-grid">
                        {ANIMATIONS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={`caption-animation-card ${animation === a.id ? 'is-active' : ''}`}
                            onClick={() => setAnimation(a.id)}
                            aria-pressed={animation === a.id}
                          >
                            <div className={`caption-animation-preview caption-anim-${a.id}-demo`}>
                              <CaptionSample preset={activePreset} animated={a.id !== 'none'} animation={a.id} size="sm" />
                            </div>
                            <div className="caption-animation-meta">
                              <strong>{a.name}</strong>
                              <span>{a.blurb}</span>
                            </div>
                            {animation === a.id && <span className="caption-preset-check"><Icon type="check" /></span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="caption-studio-footer">
              <button type="button" className="caption-studio-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="caption-studio-burn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="caption-spinner" />
                    <span>Burning…</span>
                  </>
                ) : (
                  <>
                    <Icon type="download" />
                    <span>Burn Captions{clip ? ` (Clip ${String(clip.id).padStart(2, '0')})` : ''}</span>
                  </>
                )}
              </button>
            </footer>
          </div>

          {/* RIGHT: phone preview */}
          <div className="caption-studio-preview">
            <div className="caption-preview-tag">
              <span className="caption-preview-dot" />
              <span>Live preview · 9:16</span>
            </div>
            <div className="caption-phone">
              <div className="caption-phone-bezel" />
              <div className="caption-phone-island" />
              <div className="caption-phone-screen">
                {clip ? (
                  <video
                    src={getStaticUrl(clip.video_url)}
                    className="caption-phone-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <div className="caption-phone-placeholder">
                    <Icon type="grid" />
                    <span>YOUR VIDEO HERE</span>
                  </div>
                )}
                <div className="caption-phone-vignette-top" />
                <div className="caption-phone-vignette-bottom" />

                <motion.div
                  drag
                  dragMomentum={false}
                  dragConstraints={{ top: -160, left: -60, right: 60, bottom: 160 }}
                  dragElastic={0.15}
                  className={`caption-phone-overlay ${position === 'top' ? 'pos-top' : position === 'center' ? 'pos-center' : 'pos-bottom'}`}
                >
                  <div
                    className={`caption-phone-caption caption-anim-${animation === 'none' ? '' : animation}`}
                    style={{
                      color,
                      fontSize: `${(activePresetData.style.size * size) / 100}px`,
                      textTransform: activePresetData.style.transform,
                      fontWeight: activePresetData.style.font,
                      textShadow: activePresetData.style.shadow,
                      background: activePresetData.style.bg,
                      padding: activePresetData.style.bg ? activePresetData.style.padding : '0',
                      borderRadius: activePresetData.style.radius || 0,
                      backdropFilter: activePresetData.style.backdrop ? 'blur(8px)' : undefined,
                      WebkitBackdropFilter: activePresetData.style.backdrop ? 'blur(8px)' : undefined,
                      letterSpacing: activePresetData.style.letterSpacing,
                    }}
                  >
                    {activePresetData.sample}
                  </div>
                </motion.div>
              </div>
            </div>
            <p className="caption-preview-hint">
              <Icon type="grid" />
              <span>Drag the caption to fine-tune position.</span>
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            className={`caption-toast caption-toast-${toast.type}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="status"
          >
            {toast.type === 'success' && <Icon type="check" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}