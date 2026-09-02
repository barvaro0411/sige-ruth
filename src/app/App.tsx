import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SedeProvider, useSedeStatus } from '../auth/SedeContext';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from '../auth/LoginScreen';
import InitialPasswordScreen from '../auth/InitialPasswordScreen';
import ProtectedRoute from '../auth/ProtectedRoute';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Dashboard from '../features/dashboard/Dashboard';
import EstudiantesList from '../features/estudiantes/EstudiantesList';
import FonoaudiologiaModule from '../features/fonoaudiologia/FonoaudiologiaModule';
import ReportesModule from '../features/reportes/ReportesModule';
import AuditLog from '../features/auditoria/AuditLog';
import UsuariosModule from '../features/usuarios/UsuariosModule';
import PermisosModule from '../features/permisos/PermisosModule';
import MaterialesModule from '../features/materiales/MaterialesModule';
import InventarioModule from '../features/inventario/InventarioModule';
import PedirInsumos from '../features/insumos/PedirInsumos';
import MantencionesModule from '../features/mantenciones/MantencionesModule';
import PrestamosModule from '../features/prestamos/PrestamosModule';
import PanelOperaciones from '../features/operaciones/PanelOperaciones';
import { PERMISSIONS, getDefaultRoute } from '../auth/permissions';
import { useRealtimeSync } from '../auth/useRealtimeSync';

// Layout shared for all authenticated routes
function AppLayout() {
  const { user, loading, mustChangePassword } = useAuth();
  const { sede, loading: sedesLoading, error: sedesError } = useSedeStatus();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  // Sincronización en tiempo real vía Supabase Realtime
  useRealtimeSync();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--color-navy, #1B2A4A)',
        color: 'white', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: 'var(--color-gold, #D4A843)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ fontSize: '14px', opacity: 0.7 }}>Cargando Gestión Ruth...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (mustChangePassword) return <InitialPasswordScreen />;

  if (sedesLoading) {
    return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;
  }

  if (sedesError) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>No se pudieron cargar las sedes</h2>
          <p className="text-muted">{sedesError}</p>
          <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ marginTop: '20px' }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Sin sede resuelta no hay nada que consultar: toda la app filtra por sede.
  if (!sede) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Usuario sin sede asignada</h2>
          <p className="text-muted">Pide al director que asigne al menos una sede a tu perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}><Dashboard /></ProtectedRoute>} />
            <Route path="/estudiantes" element={<ProtectedRoute permission={PERMISSIONS.VIEW_STUDENTS}><EstudiantesList /></ProtectedRoute>} />
            <Route path="/fonoaudiologia" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SESSIONS}><FonoaudiologiaModule /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute permission={PERMISSIONS.EXPORT_REPORTS}><ReportesModule /></ProtectedRoute>} />
            <Route path="/permisos" element={<ProtectedRoute permission={PERMISSIONS.REQUEST_LEAVE}><PermisosModule /></ProtectedRoute>} />
            <Route path="/materiales" element={<ProtectedRoute permission={PERMISSIONS.REQUEST_MATERIALS}><MaterialesModule /></ProtectedRoute>} />
            <Route path="/insumos" element={<ProtectedRoute permission={PERMISSIONS.REQUEST_MATERIALS}><PedirInsumos /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><InventarioModule /></ProtectedRoute>} />
            <Route path="/mantenciones" element={<ProtectedRoute permission={PERMISSIONS.REPORT_MAINTENANCE}><MantencionesModule /></ProtectedRoute>} />
            {/* Las notificaciones enlazan a /mantenciones/:id — el módulo abre ese detalle. */}
            <Route path="/mantenciones/:id" element={<ProtectedRoute permission={PERMISSIONS.REPORT_MAINTENANCE}><MantencionesModule /></ProtectedRoute>} />
            <Route path="/prestamos" element={<ProtectedRoute permission={PERMISSIONS.VIEW_LOANS}><PrestamosModule /></ProtectedRoute>} />
            <Route path="/operaciones" element={<ProtectedRoute permission={PERMISSIONS.VIEW_OPERATIONS}><PanelOperaciones /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute permission={PERMISSIONS.VIEW_AUDIT}><AuditLog /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS}><UsuariosModule /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={getDefaultRoute(user.rol)} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/**
 * Las herramientas de React Query solo existen en desarrollo. Estaban
 * importadas sin condición, así que viajaban en el bundle que descarga el
 * personal de la escuela. Con el import dentro de una rama que `import.meta.env.DEV`
 * apaga en producción, Rollup lo elimina del build entero.
 */
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools')
      .then(m => ({ default: m.ReactQueryDevtools })))
  : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          {/* SedeProvider va por dentro: la RLS de `sedes` exige sesión activa. */}
          <AuthProvider>
            <SedeProvider>
              <ToastProvider>
                <AppLayout />
              </ToastProvider>
            </SedeProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
