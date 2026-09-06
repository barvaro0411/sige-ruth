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
import BottomNav from '../components/BottomNav';
import { PERMISSIONS, getDefaultRoute } from '../auth/permissions';
import { useRealtimeSync } from '../auth/useRealtimeSync';

/**
 * Cada pantalla se descarga cuando alguien la abre.
 *
 * Estaban las trece importadas de forma estática, así que viajaban juntas en el
 * bundle inicial: la persona de aseo —cuatro permisos, ninguno de ellos sobre
 * bodega, usuarios o auditoría— descargaba igual esos módulos para entrar a
 * pedir cloro. El permiso los ocultaba; el bundle los entregaba.
 */
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const EstudiantesList = lazy(() => import('../features/estudiantes/EstudiantesList'));
const FonoaudiologiaModule = lazy(() => import('../features/fonoaudiologia/FonoaudiologiaModule'));
const ReportesModule = lazy(() => import('../features/reportes/ReportesModule'));
const AuditLog = lazy(() => import('../features/auditoria/AuditLog'));
const UsuariosModule = lazy(() => import('../features/usuarios/UsuariosModule'));
const PermisosModule = lazy(() => import('../features/permisos/PermisosModule'));
const MaterialesModule = lazy(() => import('../features/materiales/MaterialesModule'));
const InventarioModule = lazy(() => import('../features/inventario/InventarioModule'));
const PedirInsumos = lazy(() => import('../features/insumos/PedirInsumos'));
const MantencionesModule = lazy(() => import('../features/mantenciones/MantencionesModule'));
const PrestamosModule = lazy(() => import('../features/prestamos/PrestamosModule'));
const PanelOperaciones = lazy(() => import('../features/operaciones/PanelOperaciones'));

/** Lo que se ve mientras baja el módulo: la misma silueta que usan las pantallas. */
function CargandoPantalla() {
  return (
    <div className="page-container" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando la sección…</span>
      <div className="skeleton h-28 mb-6" />
      <div className="skeleton h-96" />
    </div>
  );
}

// Layout shared for all authenticated routes
function AppLayout() {
  const { user, loading, mustChangePassword } = useAuth();
  const { sede, loading: sedesLoading, error: sedesError } = useSedeStatus();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  // Sincronización en tiempo real vía Supabase Realtime
  useRealtimeSync();

  if (loading) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <div className="boot-spinner" aria-hidden="true" />
        <p className="boot-label">Cargando Gestión Ruth…</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (mustChangePassword) return <InitialPasswordScreen />;

  if (sedesLoading) {
    return <div className="page-container"><div className="skeleton h-100" /></div>;
  }

  if (sedesError) {
    return (
      <div className="page-container">
        <div className="card aviso-card">
          <h2>No se pudieron cargar las sedes</h2>
          <p className="text-muted">{sedesError}</p>
          <button className="btn btn-outline mt-5" onClick={() => window.location.reload()}>
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
        <div className="card aviso-card">
          <h2>Usuario sin sede asignada</h2>
          <p className="text-muted">Pide al director que asigne al menos una sede a tu perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      {/* Primero en el orden de tabulación: quien navega con teclado no tiene
          que recorrer los trece enlaces del menú en cada pantalla. */}
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="main-content" id="contenido" tabIndex={-1}>
          <Suspense fallback={<CargandoPantalla />}>
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
          </Suspense>
        </main>
        <BottomNav onMenuToggle={() => setSidebarOpen(true)} />
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
