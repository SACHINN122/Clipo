import { loginWithGoogle } from '../lib/auth';
import ClipoMark from './ClipoMark';

// Note: Google auth has been removed as requested. Guest authentication is now available.

export default function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <ClipoMark />
        </div>
        <h1 className="login-title">Welcome to Clipo</h1>
        <p className="login-subtitle">
          AI-powered short-form clip generator.
          <br />
          Sign in to start creating.
        </p>
        <button className="login-btn guest-btn" onClick={loginAsGuest}>
          <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8 }}>
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41 1.41 1.41 5-5 1.41 1.41-1.41 1.41zm0-8l-3 3-1.41-1.41 3-3 1.41 1.41-3 3z"
              fill="#34A853"
            />
          </svg>
          Sign in as Guest
        </button>
        <p className="login-footer">
          Guest access: No login required. You can create clips without an account.
        </p>
      </div>
    </div>
  );
}
