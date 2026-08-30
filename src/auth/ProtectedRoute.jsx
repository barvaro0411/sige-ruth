import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getDefaultRoute, hasPermission } from './permissions';

export default function ProtectedRoute({ children, permission }) {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}>
        <div className="animate-pulse" style={{
          fontSize: 'var(--text-lg)',
          color: 'var(--text-secondary)',
        }}>
          Cargando...
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(user.rol, permission)) {
    return <Navigate to={getDefaultRoute(user.rol)} replace />;
  }

  return children;
}
