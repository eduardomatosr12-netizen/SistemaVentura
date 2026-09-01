import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, DollarSign, Package } from 'lucide-react';

type LoginRole = 'admin' | 'user';

interface MainLayoutProps {
  children: ReactNode;
  hideSubmenu?: boolean;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { 
    isAuthenticated, 
    isLoading, 
    employeeName, 
    availableEmployees,
    login, 
    selectEmployee 
  } = useAuth();

  const [loginRole, setLoginRole] = useState<LoginRole>('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      const authEmail = import.meta.env.VITE_AUTH_EMAIL || '';
      
      if (!authEmail) {
        console.error('[AUTH] Variável VITE_AUTH_EMAIL não configurada no .env');
        setLoginError('Variáveis de autenticação não configuradas. Contate o administrador.');
        setIsLoggingIn(false);
        return;
      }

      if (!loginPassword) {
        setLoginError('Digite sua senha.');
        setIsLoggingIn(false);
        return;
      }

      const result = await login(authEmail, loginPassword);
      if (!result.success) {
        if (result.error?.includes('não encontrado')) {
          console.error('[AUTH] Credencial não encontrada para:', authEmail);
        }
        setLoginError(result.error || 'Erro ao fazer login');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      console.error('[AUTH] Erro inesperado:', message);
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B5FF03]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#111] rounded-3xl shadow-xl p-8 md:p-12 border border-[#333]">
            <div className="text-center mb-8">
              <img
                src="/logo.png"
                alt="Ventura Luz e Efeitos"
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
                  onClick={() => setLoginRole('user')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    loginRole === 'user' 
                      ? 'border-[#B5FF03] bg-black text-[#B5FF03]' 
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                >
                  <Users className={`w-6 h-6 ${loginRole === 'user' ? 'text-[#B5FF03]' : 'text-neutral-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${loginRole === 'user' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>Funcionário</span>
                </button>
              </div>

              {loginRole === 'user' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Selecione seu nome</label>
                  {availableEmployees.length > 0 ? (
                    <select
                      value={employeeName || ''}
                      onChange={(e) => selectEmployee(e.target.value)}
                      className="w-full bg-[#111] border-2 border-[#333] rounded-xl px-4 py-3 font-bold text-white focus:border-[#B5FF03] outline-none"
                    >
                      {availableEmployees.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-[#111] border-2 border-[#333] rounded-xl px-4 py-3 font-bold text-neutral-500">
                      Nenhum funcionário cadastrado
                    </div>
                  )}
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

  return (
    <div className="flex h-dvh bg-black overflow-x-hidden overflow-y-hidden">

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 ml-0 md:ml-[220px] flex flex-col overflow-y-auto overflow-x-hidden w-full bg-black">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 bg-black w-full min-w-0">
          <div className="p-4 md:p-8 w-full pb-bottom-nav md:pb-6">
            {children}
          </div>
        </div>
      </main>

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#333] flex md:hidden justify-around items-center h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'var(--bottom-nav-height, 64px)' }}>
        <Link to="/home" className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[48px] justify-center ${location.pathname === '/home' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link to="/contatos" className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[48px] justify-center ${location.pathname === '/contatos' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <Users size={20} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Contatos</span>
        </Link>
        <Link to="/tarefas" className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[48px] justify-center ${location.pathname === '/tarefas' ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <Package size={20} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Estoque</span>
        </Link>
        <Link to="/financeiro" className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[48px] justify-center ${location.pathname.startsWith('/financeiro') ? 'text-[#B5FF03]' : 'text-neutral-400'}`}>
          <DollarSign size={20} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Financeiro</span>
        </Link>
      </nav>
    </div>
  );
};

export default MainLayout;
