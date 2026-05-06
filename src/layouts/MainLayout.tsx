import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CRMSubmenu from '../components/CRMSubmenu';
import TopHeader from '../components/TopHeader';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Users, Lock } from 'lucide-react';

type UserRole = 'admin' | 'employee';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isCRMRoute = location.pathname.startsWith('/crm');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { 
    isAuthenticated, 
    isLoading, 
    role, 
    employeeName, 
    availableEmployees,
    login, 
    selectEmployee 
  } = useAuth();

  const [loginRole, setLoginRole] = useState<UserRole>('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      await login(loginRole, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-100 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
            <div className="text-center mb-8">
              <img
                src="/logo.png"
                alt="Universo Axium"
                className="h-12 w-auto object-contain mx-auto mb-6"
              />
              <h1 className="text-2xl md:text-3xl font-black text-black tracking-tighter">Acesso Sistema</h1>
              <p className="text-neutral-500 text-sm font-medium mt-2">Selecione seu tipo de acesso</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setLoginRole('admin')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    loginRole === 'admin' 
                      ? 'border-black bg-black text-white' 
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <BarChart3 className={`w-6 h-6 ${loginRole === 'admin' ? 'text-white' : 'text-neutral-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${loginRole === 'admin' ? 'text-white' : 'text-neutral-600'}`}>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginRole('employee')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    loginRole === 'employee' 
                      ? 'border-black bg-black text-white' 
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Users className={`w-6 h-6 ${loginRole === 'employee' ? 'text-white' : 'text-neutral-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${loginRole === 'employee' ? 'text-white' : 'text-neutral-600'}`}>Funcionário</span>
                </button>
              </div>

              {loginRole === 'employee' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Selecione seu nome</label>
                  <select
                    value={employeeName || ''}
                    onChange={(e) => selectEmployee(e.target.value)}
                    className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 font-bold text-black focus:border-black outline-none"
                  >
                    {availableEmployees.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Senha
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={loginRole === 'admin' ? 'admin123' : 'func123'}
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 font-bold text-black focus:border-black outline-none"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 bg-black text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
              >
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
              <p className="text-xs text-neutral-400">
                Admin: admin123 | Funcionário: func123
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-100 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 ml-0 md:ml-64 flex flex-col overflow-y-auto w-full">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />

        {isCRMRoute && (
          <div className="sticky top-[61px] z-20">
            <CRMSubmenu />
          </div>
        )}

        <div className="flex-1 bg-neutral-50 w-full">
          <div className="px-4 p-4 md:p-8 w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;