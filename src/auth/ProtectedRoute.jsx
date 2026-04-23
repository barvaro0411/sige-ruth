import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasPermission } from './permissions';

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
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <h3 className="empty-state-title">Acceso Restringido</h3>
          <p className="empty-state-text">
            No tienes permisos para acceder a esta sección. Contacta al Director(a) si necesitas acceso.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
