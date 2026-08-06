/**
 * Completion ping via Web Audio.
 *
 * Browsers block autoplay audio until the user interacts with the page, so the
 * AudioContext is created/resumed on a user gesture (upload submit, toggle click,
 * test click). After that a background tab can still play the chime, which gives
 * a reliable "exports ready" signal that needs no OS notification settings.
 */

let ctx = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

/** Must be called from a user gesture so the chime can play later. */
export function unlockAudio() {
  const ac = getContext();
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

/** Play a short two-note "ready" chime. Safe to call anytime after unlock. */
export function playCompletionChime() {
  const ac = getContext();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  if (ac.state !== 'running') return;
  const notes = [
    { freq: 660, at: 0 },
    { freq: 880, at: 0.18 },
  ];
  notes.forEach(({ freq, at }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = ac.currentTime + at;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  });
}
