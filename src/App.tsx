import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { UserRole } from './contexts/AuthContext';
import { CRMProvider } from './contexts/CRMContext';
import { ActivityLogsProvider } from './contexts/ActivityContext';
import { FilterProvider } from './contexts/FilterContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import UpdatePassword from './pages/UpdatePassword';
import MainLayout from './layouts/MainLayout';
import CRMPainel from './pages/crm/Painel';
import CRMLeads from './pages/crm/Leads';
import CRMPipeline from './pages/crm/Pipeline';
import CRMCalendario from './pages/crm/Calendario';
import CRMImportar from './pages/crm/Importar';
import CRMIntegracoes from './pages/crm/Integracoes';
import Financeiro from './pages/financeiro/Index';
import Tarefas from './pages/tarefas/Index';
import Configuracoes from './pages/configuracoes/Index';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/crm/painel" replace /> : <Login />}
      />

      {/* Unauthorized Route */}
      <Route
        path="/unauthorized"
        element={
          <div className="h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-black text-black mb-2">Acesso Negado</h1>
              <p className="text-neutral-500">Você não tem permissão para acessar esta página.</p>
              <a href="/crm/painel" className="text-black underline mt-4 block">Voltar ao início</a>
            </div>
          </div>
        }
      />

      {/* Update Password Route */}
      <Route
        path="/update-password"
        element={<UpdatePassword />}
      />

      {/* Protected Routes - CRM - All authenticated users */}
      <Route
        path="/crm/painel"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout>
              <CRMPainel />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm/leads"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout>
              <CRMLeads />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm/pipeline"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout>
              <CRMPipeline />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm/calendario"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout>
              <CRMCalendario />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm/importar"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <MainLayout>
              <CRMImportar />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm/integracoes"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout>
              <CRMIntegracoes />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Redirect /crm to /crm/painel */}
      <Route path="/crm" element={<Navigate to="/crm/painel" replace />} />

      {/* Protected Routes - Financeiro - Only admin/manager */}
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <MainLayout>
              <Financeiro />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Routes - Tarefas - All authenticated users */}
      <Route
        path="/tarefas"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
            <MainLayout>
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
            <MainLayout>
              <Configuracoes />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Root redirect to login or dashboard based on auth */}
      <Route path="/" element={<Navigate to={isAuthenticated ? '/crm/painel' : '/login'} replace />} />

      {/* Fallback for unknown routes */}
      <Route path="*" element={<Navigate to="/crm/painel" replace />} />
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
              <FilterProvider>
                <AppRoutes />
              </FilterProvider>
            </CRMProvider>
          </ActivityLogsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;