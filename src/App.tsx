import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { UserRole } from './contexts/AuthContext';
import { CRMProvider } from './contexts/CRMContext';
import { FinanceProvider } from './contexts/FinanceContext';
import { ActivityLogsProvider } from './contexts/ActivityContext';
import { FilterProvider } from './contexts/FilterContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import UpdatePassword from './pages/UpdatePassword';
import MainLayout from './layouts/MainLayout';
import CRMPainel from './pages/crm/Painel';
import OrçamentosPage from './pages/crm/Orçamentos';
import CRMCalendario from './pages/crm/Calendario';
import CRMImportar from './pages/crm/Importar';
import Financeiro from './pages/financeiro/Index';
import Tarefas from './pages/tarefas/Index';
import Configuracoes from './pages/configuracoes/Index';
import TemplatesWhatsApp from './pages/configuracoes/TemplatesWhatsApp';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
      />

      {/* Unauthorized Route */}
      <Route
        path="/unauthorized"
        element={
          <div className="h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-black text-black mb-2">Acesso Negado</h1>
              <p className="text-neutral-500">Você não tem permissão para acessar esta página.</p>
              <a href="/home" className="text-black underline mt-4 block">Voltar ao início</a>
            </div>
          </div>
        }
      />

      {/* Update Password Route */}
      <Route
        path="/update-password"
        element={<UpdatePassword />}
      />

      {/* HOME - Página Principal (Dashboard) */}
      <Route
        path="/home"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <CRMPainel />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* CONTATOS - Independente */}
      <Route
        path="/contatos"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <OrçamentosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* REUNIÃO - Independente (mesmo layout de calendário) */}
      <Route
        path="/reuniao"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <CRMCalendario />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* CALENDÁRIO - Independente */}
      <Route
        path="/calendario"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <CRMCalendario />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* CLIENTES - Independente */}
      <Route
        path="/clientes"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <OrçamentosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Legacy CRM routes - keep for backward compatibility */}
      <Route path="/crm/painel" element={<Navigate to="/home" replace />} />
      <Route path="/crm/pipeline" element={<Navigate to="/home" replace />} />
      <Route path="/crm/orcamentos" element={<Navigate to="/contatos" replace />} />
      <Route path="/crm/calendario" element={<Navigate to="/calendario" replace />} />
      <Route path="/crm/reuniao" element={<Navigate to="/reuniao" replace />} />
      <Route path="/crm/clientes" element={<Navigate to="/clientes" replace />} />
      <Route path="/crm/importar" element={<Navigate to="/home" replace />} />
      <Route path="/crm" element={<Navigate to="/home" replace />} />

      {/* Protected Routes - Financeiro - Only admin/manager */}
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <MainLayout hideSubmenu>
              <Financeiro />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Routes - Estoque - All authenticated users */}
      <Route
        path="/tarefas"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout hideSubmenu>
              <Tarefas />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Routes - Configurações - Only admin */}
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout hideSubmenu>
              <Configuracoes />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes/templates-whatsapp"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout hideSubmenu>
              <TemplatesWhatsApp />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Root redirect to login or dashboard based on auth */}
      <Route path="/" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />

      {/* Fallback for unknown routes */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
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