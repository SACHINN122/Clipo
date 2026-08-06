import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (iOS && isSafari) {
      setIsIOS(true);
      const dismissed = localStorage.getItem('clipo_pwa_dismissed');
      if (!dismissed) setShowPrompt(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('clipo_pwa_dismissed');
      if (!dismissed) setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('clipo_pwa_dismissed', '1');
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 9999, padding: '16px',
      paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff', fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '15px' }}>
            {isIOS ? 'Install Clipo' : 'Add to Home Screen'}
          </strong>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
            {isIOS
              ? 'Tap Share then "Add to Home Screen" for the full app experience.'
              : 'Install Clipo for a faster, native-like experience.'}
          </p>
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              background: '#fff', color: '#667eea', border: 'none',
              borderRadius: '8px', padding: '8px 16px', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent', color: '#fff', border: 'none',
            fontSize: '20px', cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
