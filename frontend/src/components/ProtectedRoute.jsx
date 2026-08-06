import { useAuth } from '../contexts/AuthContext';
import LoginScreen from './LoginScreen';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

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
