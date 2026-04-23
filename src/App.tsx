import { useState, useMemo } from 'react';
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
import BottomNav from './components/BottomNav';

// Layout shared for all authenticated routes
function AppLayout() {
  const { user } = useAuth();
  const { sede } = useSede();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  if (!user) return <LoginScreen />;

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/estudiantes" element={<EstudiantesList />} />
            <Route path="/asistencia" element={<PaseDeLista />} />
            <Route path="/fonoaudiologia" element={<FonoaudiologiaModule />} />
            <Route path="/reportes" element={<ReportesModule />} />
            <Route path="/auditoria" element={<AuditLog />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
