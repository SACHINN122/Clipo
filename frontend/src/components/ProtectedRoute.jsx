import { useAuth } from '../contexts/AuthContext';
import LoginScreen from './LoginScreen';

// Local development should open the Clipo dashboard directly. Keep the
// authentication implementation below so it can be re-enabled for hosted use.
const isLocalHost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (isLocalHost()) {
    return children;
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo"><span className="spinner" /></div>
          <p className="login-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return children;
}
