import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SedeProvider, useSede } from './config/SedeContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import LoginScreen from './auth/LoginScreen';
import ProtectedRoute from './auth/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './features/dashboard/Dashboard';
import EstudiantesList from './features/estudiantes/EstudiantesList';
import PaseDeLista from './features/asistencia/PaseDeLista';
import FonoaudiologiaModule from './features/fonoaudiologia/FonoaudiologiaModule';
import ReportesModule from './features/reportes/ReportesModule';
import AuditLog from './features/auditoria/AuditLog';
import UsuariosModule from './features/usuarios/UsuariosModule';
import PermisosModule from './features/permisos/PermisosModule';
import MaterialesModule from './features/materiales/MaterialesModule';
import BottomNav from './components/BottomNav';
import { PERMISSIONS, getDefaultRoute } from './auth/permissions';

// Layout shared for all authenticated routes
function AppLayout() {
  const { user, loading } = useAuth();
  const { sede, setSede, availableSedes } = useSede();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    if (!user || user.rol === 'director' || user.sedeIds.includes(sede.id)) return;
    const assignedSede = availableSedes.find(item => user.sedeIds.includes(item.id));
    if (assignedSede) setSede(assignedSede);
  }, [availableSedes, sede.id, setSede, user]);

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

  // Evita consultar accidentalmente la sede guardada de otro usuario durante
  // el instante en que se sincroniza la sede asignada al perfil actual.
  if (user.rol !== 'director' && user.sedeIds.length === 0) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Usuario sin sede asignada</h2>
          <p className="text-muted">Solicita al director que asigne al menos una sede a tu perfil.</p>
        </div>
      </div>
    );
  }

  if (user.rol !== 'director' && !user.sedeIds.includes(sede.id)) {
    return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;
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
            <Route path="/asistencia" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ATTENDANCE}><PaseDeLista /></ProtectedRoute>} />
            <Route path="/fonoaudiologia" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SESSIONS}><FonoaudiologiaModule /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute permission={PERMISSIONS.EXPORT_REPORTS}><ReportesModule /></ProtectedRoute>} />
            <Route path="/permisos" element={<ProtectedRoute permission={PERMISSIONS.REQUEST_LEAVE}><PermisosModule /></ProtectedRoute>} />
            <Route path="/materiales" element={<ProtectedRoute permission={PERMISSIONS.REQUEST_MATERIALS}><MaterialesModule /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute permission={PERMISSIONS.VIEW_AUDIT}><AuditLog /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS}><UsuariosModule /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={getDefaultRoute(user.rol)} replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

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
          <SedeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLayout />
              </ToastProvider>
            </AuthProvider>
          </SedeProvider>
        </BrowserRouter>
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
