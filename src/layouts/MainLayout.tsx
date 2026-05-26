import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import { useAuth } from '../contexts/AuthContext';
import { useCRM } from '../contexts/CRMContext';
import { LayoutDashboard, Users, DollarSign, Loader2 } from 'lucide-react';

type UserRole = 'admin' | 'employee';

interface MainLayoutProps {
  children: ReactNode;
  hideSubmenu?: boolean;
}

const MainLayout = ({ children, hideSubmenu }: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
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
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B5FF03]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#111] rounded-3xl shadow-xl p-8 md:p-12 border border-[#333]">
            <div className="text-center mb-8">
              <img
                src="/logo.png"
                alt="Universo Axium"
                className="h-12 w-auto object-contain mx-auto mb-6"
              />
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Acesso Sistema</h1>
              <p className="text-neutral-400 text-sm font-medium mt-2">Selecione seu tipo de acesso</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setLoginRole('admin')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    loginRole === 'admin' 
                      ? 'border-[#B5FF03] bg-black text-[#B5FF03]' 
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                >
                  <LayoutDashboard className={`w-6 h-6 ${loginRole === 'admin' ? 'text-[#B5FF03]' : 'text-neutral-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${loginRole === 'admin' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginRole('employee')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    loginRole === 'employee' 
                      ? 'border-[#B5FF03] bg-black text-[#B5FF03]' 
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                >
                  <Users className={`w-6 h-6 ${loginRole === 'employee' ? 'text-[#B5FF03]' : 'text-neutral-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${loginRole === 'employee' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>Funcionário</span>
                </button>
              </div>

              {loginRole === 'employee' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Selecione seu nome</label>
                  <select
                    value={employeeName || ''}
                    onChange={(e) => selectEmployee(e.target.value)}
                    className="w-full bg-[#111] border-2 border-[#333] rounded-xl px-4 py-3 font-bold text-white focus:border-[#B5FF03] outline-none"
                  >
                    {availableEmployees.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Users className="w-3 h-3" /> Senha
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-[#111] border-2 border-[#333] rounded-xl px-4 py-3 font-bold text-white focus:border-[#B5FF03] outline-none"
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
                className="w-full py-4 bg-[#B5FF03] text-black rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#a1e600] transition-all disabled:opacity-50"
              >
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </button>
            </form>


          </div>
        </div>
      </div>
    );
  }

  const { isLoading: crmLoading } = useCRM();

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {crmLoading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-[#B5FF03] animate-spin" />
            <span className="text-sm font-bold text-[#B5FF03]">Carregando dados...</span>
          </div>
        </div>
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 ml-0 md:ml-64 flex flex-col overflow-y-auto w-full bg-black">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 bg-black w-full">
          <div className="px-4 p-4 md:p-8 w-full pb-20 md:pb-4">
            {children}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#333] flex md:hidden justify-around items-center h-16 safe-area-bottom">
        <Link to="/home" className={`flex flex-col items-center gap-0.5 px-3 py-2 ${location.pathname === '/home' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link to="/contatos" className={`flex flex-col items-center gap-0.5 px-3 py-2 ${location.pathname === '/contatos' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Contatos</span>
        </Link>
        <Link to="/financeiro" className={`flex flex-col items-center gap-0.5 px-3 py-2 ${location.pathname.startsWith('/financeiro') ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <DollarSign size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Financeiro</span>
        </Link>
      </nav>
    </div>
  );
};

export default MainLayout;