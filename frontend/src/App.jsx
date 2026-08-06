import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { startProcessing, getStatus } from './lib/api';
import { showCompletionNotification, getNotificationPermission } from './lib/notifications';
import { playCompletionChime } from './lib/sound';
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';
import ReportScreen from './components/ReportScreen';
import ProfileScreen from './components/ProfileScreen';
import LibraryScreen from './components/LibraryScreen';
import SettingsScreen from './components/SettingsScreen';
import AuthCallback from './components/AuthCallback';

const SCREEN = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  RESULTS: 'results',
  PROFILE: 'profile',
  LIBRARY: 'library',
  SETTINGS: 'settings',
};

function Studio() {
  const [screen, setScreen] = useState(SCREEN.UPLOAD);
  const [jobId, setJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [notifyWhenComplete, setNotifyWhenComplete] = useState(false);
  const [startupError, setStartupError] = useState(null);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const armedJobRef = useRef(null);
  const notifiedJobsRef = useRef(new Set());

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleProcessingStart = useCallback(async (newJobId, options = {}) => {
    setJobId(newJobId);
    armedJobRef.current = newJobId;
    setNotifyWhenComplete(Boolean(options.notifyWhenComplete));
    setJobDetails({
      videoName: options.videoName || 'Untitled video',
      sourceType: options.sourceType || 'file',
      createdAt: options.createdAt || new Date().toISOString(),
    });
    try {
      await startProcessing(newJobId);
      setScreen(SCREEN.PROCESSING);
    } catch (err) {
      setStartupError(err.message || 'Failed to start processing');
    }
  }, []);

  const handleComplete = useCallback(() => {
    setScreen(SCREEN.RESULTS);
  }, []);

  const handleError = useCallback((errorMsg) => {
    console.error('Pipeline error:', errorMsg);
  }, []);

  const handleReset = useCallback(() => {
    setScreen(SCREEN.UPLOAD);
    setJobId(null);
    armedJobRef.current = null;
    setJobDetails(null);
    setNotifyWhenComplete(false);
  }, []);

  // Completion alert watcher: runs while any armed job is active, no matter
  // which screen the user is on (the Processing screen unmounts when they
  // navigate elsewhere, which used to kill notifications with it).
  useEffect(() => {
    if (!jobId || armedJobRef.current !== jobId || !notifyWhenComplete) return;
    let active = true;
    let timeoutId;
    const WATCH_MS = 5000;
    async function watch() {
      try {
        const data = await getStatus(jobId);
        if (!active) return;
        if (data.status === 'completed') {
          if (!notifiedJobsRef.current.has(jobId)) {
            notifiedJobsRef.current.add(jobId);
            playCompletionChime();
            if (getNotificationPermission() === 'granted') {
              showCompletionNotification(jobId, jobDetails?.videoName);
            }
          }
          return;
        }
        if (data.status === 'failed') return;
      } catch {
        // Offline or transient error — keep watching.
      }
      if (!active) return;
      timeoutId = setTimeout(watch, WATCH_MS);
    }
    watch();
    return () => { active = false; clearTimeout(timeoutId); };
  }, [jobId, notifyWhenComplete, jobDetails?.videoName]);

  const handleVisitJob = useCallback(async (jobId, jobDetails) => {
    try {
      await getStatus(jobId);
    } catch {
      const key = 'clipo_job_history';
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const history = JSON.parse(raw);
          const updated = history.filter((j) => j.jobId !== jobId);
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch { /* ignore */ }
      setStartupError('This job is no longer available and has been removed from your history.');
      return;
    }
    setJobId(jobId);
    setJobDetails(jobDetails || {});
    setScreen(SCREEN.RESULTS);
  }, []);

  const handleLeaveProcessing = useCallback(() => {
    setScreen(SCREEN.UPLOAD);
  }, []);

  const handleNavigate = useCallback((tab) => {
    switch (tab) {
      case 'create': setScreen(SCREEN.UPLOAD); break;
      case 'library': setScreen(SCREEN.LIBRARY); break;
      case 'settings': setScreen(SCREEN.SETTINGS); break;
      case 'profile': setScreen(SCREEN.PROFILE); break;
      default: setScreen(SCREEN.UPLOAD);
    }
  }, []);

  const tabMap = {
    [SCREEN.UPLOAD]: 'create',
    [SCREEN.PROCESSING]: 'create',
    [SCREEN.RESULTS]: 'create',
    [SCREEN.PROFILE]: 'profile',
    [SCREEN.LIBRARY]: 'library',
    [SCREEN.SETTINGS]: 'settings',
  };

  return (
    <>
      {isOffline && (
        <div className="connection-notice" role="alert">
          <div>
            <strong>No internet connection</strong>
            <span>Check your connection and try again. Your current project may not finish until you reconnect.</span>
          </div>
          <button type="button" onClick={handleReset}>Start a new project</button>
        </div>
      )}
      {startupError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#dc2626', color: '#fff', padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <span>{startupError}</span>
          <button
            onClick={() => setStartupError(null)}
            style={{
              background: 'transparent', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '18px', padding: '0 8px',
            }}
          >
            ✕
          </button>
        </div>
      )}
      {screen === SCREEN.UPLOAD && (
        <UploadScreen onProcessingStart={handleProcessingStart} onNavigate={handleNavigate} onVisitJob={handleVisitJob} />
      )}
      {screen === SCREEN.PROCESSING && (
        <ProcessingScreen
          jobId={jobId}
          jobDetails={jobDetails}
          notifyWhenComplete={notifyWhenComplete}
          onNotificationChange={setNotifyWhenComplete}
          onLeave={handleLeaveProcessing}
          onComplete={handleComplete}
          onError={handleError}
          onConnectionChange={setIsOffline}
        />
      )}
      {screen === SCREEN.RESULTS && (
        <ResultsScreen jobId={jobId} onReset={handleReset} onNavigate={handleNavigate} />
      )}
      {screen === SCREEN.PROFILE && (
        <ProfileScreen onNavigate={handleNavigate} />
      )}
      {screen === SCREEN.LIBRARY && (
        <LibraryScreen onNavigate={handleNavigate} onVisitJob={handleVisitJob} />
      )}
      {screen === SCREEN.SETTINGS && (
        <SettingsScreen onNavigate={handleNavigate} />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/report" element={<ProtectedRoute><ReportScreen /></ProtectedRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Studio />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
