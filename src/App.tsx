import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SedeProvider, useSede } from './config/SedeContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import { canSwitchSede, getDefaultRoute, PERMISSIONS } from './auth/permissions';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from './auth/LoginScreen';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const EstudiantesList = lazy(() => import('./features/estudiantes/EstudiantesList'));
const PaseDeLista = lazy(() => import('./features/asistencia/PaseDeLista'));
const FonoaudiologiaModule = lazy(() => import('./features/fonoaudiologia/FonoaudiologiaModule'));
const ReportesModule = lazy(() => import('./features/reportes/ReportesModule'));
const AuditLog = lazy(() => import('./features/auditoria/AuditLog'));

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((module) => ({ default: module.ReactQueryDevtools })))
  : null;

function FullPageLoading() {
  return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;
}

// Layout shared for all authenticated routes
function AppLayout() {
  const { user, loading } = useAuth();
  const { sede, setSede, availableSedes } = useSede();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    if (!user?.sedeId || sede.id === user.sedeId || canSwitchSede(user.rol)) return;
    const assignedSede = availableSedes.find(s => s.id === user.sedeId);
    if (assignedSede) setSede(assignedSede);
  }, [availableSedes, sede.id, setSede, user?.rol, user?.sedeId]);

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
        <p style={{ fontSize: '14px', opacity: 0.7 }}>Cargando SIGE Ruth...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
        <main className="main-content">
          <Suspense fallback={<FullPageLoading />}>
            <Routes>
              <Route path="/dashboard" element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}><Dashboard /></ProtectedRoute>} />
              <Route path="/estudiantes" element={<ProtectedRoute permission={PERMISSIONS.VIEW_STUDENTS}><EstudiantesList /></ProtectedRoute>} />
              <Route path="/asistencia" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ATTENDANCE}><PaseDeLista /></ProtectedRoute>} />
              <Route path="/fonoaudiologia" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SESSIONS}><FonoaudiologiaModule /></ProtectedRoute>} />
              <Route path="/reportes" element={<ProtectedRoute permission={PERMISSIONS.EXPORT_REPORTS}><ReportesModule /></ProtectedRoute>} />
              <Route path="/auditoria" element={<ProtectedRoute permission={PERMISSIONS.VIEW_AUDIT}><AuditLog /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to={getDefaultRoute(user.rol)} replace />} />
            </Routes>
          </Suspense>
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
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
