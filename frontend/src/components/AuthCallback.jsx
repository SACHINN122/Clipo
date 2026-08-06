import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser, setSessionToken } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/token=([^&]+)/);
    if (match) {
      setSessionToken(match[1]);
    }
    getCurrentUser().then((user) => {
      if (user) {
        setUser(user);
        navigate('/', { replace: true });
      } else {
        navigate('/?error=auth_failed', { replace: true });
      }
    });
  }, [navigate, setUser]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo"><span className="spinner" /></div>
        <p className="login-subtitle">Signing you in...</p>
      </div>
    </div>
  );
}
