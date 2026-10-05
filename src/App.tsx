import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CRMProvider } from './contexts/CRMContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { ActivityLogsProvider } from './contexts/ActivityContext';
import { FilterProvider } from './contexts/FilterContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PwaUpdateBanner from './components/PwaUpdateBanner';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';

// Route-level code splitting. Every page used to be pulled into the entry chunk,
// which shipped ~1.3 MB (363 kB gzip) before first paint — painful on mobile
// data. Login stays eager because it is the first paint for signed-out users.
const CRMPainel = lazy(() => import('./pages/crm/Painel'));
const OrcamentosPage = lazy(() => import('./pages/crm/Orçamentos'));
const CRMCalendario = lazy(() => import('./pages/crm/Calendario'));
const Financeiro = lazy(() => import('./pages/financeiro/Index'));
const DashboardFinanceiro = lazy(() => import('./pages/financeiro/Dashboard'));
const Tarefas = lazy(() => import('./pages/tarefas/Index'));
const Configuracoes = lazy(() => import('./pages/configuracoes/Index'));
const TemplatesWhatsApp = lazy(() => import('./pages/configuracoes/TemplatesWhatsApp'));

const ALL_ROLES = ['admin', 'manager', 'user'] as const;

function RouteFallback() {
  return (
    <div
      className="h-dvh w-full flex items-center justify-center bg-black safe-area-top"
      role="status"
      aria-live="polite"
    >
      <div className="w-8 h-8 border-4 border-white/10 border-t-[#CDFF00] rounded-full animate-spin" />
    </div>
  );
}

const protectedPage = (element: React.ReactNode) => (
  <ProtectedRoute allowedRoles={[...ALL_ROLES]}>
    <Suspense fallback={<RouteFallback />}>
      <MainLayout>{element}</MainLayout>
    </Suspense>
  </ProtectedRoute>
);

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
        />

        {/* Standalone pages — no shell, so they handle their own safe areas. */}
        <Route
          path="/unauthorized"
          element={
            <div className="h-dvh w-full flex items-center justify-center bg-black px-4 text-center safe-area-top safe-area-bottom">
              <div>
                <h1 className="text-2xl font-black text-white mb-2">Acesso Negado</h1>
                <p className="text-neutral-400">Você não tem permissão para acessar esta página.</p>
                <a
                  href="/home"
                  className="text-[#CDFF00] underline mt-4 inline-block min-h-[44px] leading-[44px]"
                >
                  Voltar ao início
                </a>
              </div>
            </div>
          }
        />

        <Route path="/home" element={protectedPage(<CRMPainel />)} />
        <Route path="/contatos" element={protectedPage(<OrcamentosPage />)} />
        <Route path="/clientes" element={protectedPage(<OrcamentosPage />)} />
        <Route path="/reuniao" element={protectedPage(<CRMCalendario />)} />
        <Route path="/calendario" element={protectedPage(<CRMCalendario />)} />
        <Route path="/financeiro" element={protectedPage(<Financeiro />)} />
        <Route path="/financeiro/dashboard" element={protectedPage(<DashboardFinanceiro />)} />
        <Route path="/tarefas" element={protectedPage(<Tarefas />)} />
        <Route path="/configuracoes" element={protectedPage(<Configuracoes />)} />
        <Route path="/configuracoes/templates-whatsapp" element={protectedPage(<TemplatesWhatsApp />)} />

        {/* Legacy CRM routes - keep for backward compatibility */}
        <Route path="/crm/painel" element={<Navigate to="/home" replace />} />
        <Route path="/crm/pipeline" element={<Navigate to="/home" replace />} />
        <Route path="/crm/orcamentos" element={<Navigate to="/clientes" replace />} />
        <Route path="/crm/calendario" element={<Navigate to="/calendario" replace />} />
        <Route path="/crm/reuniao" element={<Navigate to="/reuniao" replace />} />
        <Route path="/crm/clientes" element={<Navigate to="/clientes" replace />} />
        <Route path="/crm" element={<Navigate to="/home" replace />} />

        <Route path="/" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>

      <PwaUpdateBanner />
    </>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <ActivityLogsProvider>
            <CRMProvider>
              <FinanceProvider>
                <FilterProvider>
                  <AppRoutes />
                </FilterProvider>
              </FinanceProvider>
            </CRMProvider>
          </ActivityLogsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
