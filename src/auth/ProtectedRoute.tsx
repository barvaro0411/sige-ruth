import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getDefaultRoute, hasPermission, Permiso } from './permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: Permiso;
}

export default function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
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
        <div className="animate-pulse text-lg text-secondary">
          Cargando...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(user.rol, permission)) {
    return <Navigate to={getDefaultRoute(user.rol)} replace />;
  }

  return <>{children}</>;
}
