import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="paper-grain" />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="zine-spinner" style={{ margin: '0 auto 1.25rem' }} />
          <p className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Synchronizing AlgoArena...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
