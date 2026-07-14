import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, DollarSign } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  hideSubmenu?: boolean;
}

const MainLayout = ({ children, hideSubmenu }: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B5FF03]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B5FF03]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-black overflow-hidden">

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