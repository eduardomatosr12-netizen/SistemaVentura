import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, DollarSign, Package, Settings, LogOut, X, User, MessageCircle, LayoutDashboard, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();

  const mainMenuItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, path: '/home', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'clientes', label: 'Clientes', icon: Phone, path: '/clientes', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'tarefas', label: 'Estoque', icon: Package, path: '/tarefas', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/financeiro', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'configuracoes', label: 'Configurações', icon: Settings, path: '/configuracoes', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'templates-whatsapp', label: 'Templates WhatsApp', icon: MessageCircle, path: '/configuracoes/templates-whatsapp', allowedRoles: ['admin', 'manager', 'user'] as const },
  ];

  const visibleMenuItems = !hasPermission ? mainMenuItems : mainMenuItems.filter(item => 
    item.allowedRoles.includes(user?.role as any)
  );

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed md:hidden left-0 top-0 h-dvh w-[85vw] max-w-[320px] bg-black border-r border-[rgba(255,255,255,0.08)] flex-col overflow-y-auto overflow-x-hidden z-[60] transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-[#222]"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5 text-[#A0A0A0] hover:text-[#CCFF00]" />
        </button>
        
        <div className="px-4 pt-4 pb-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-center">
          <img src="/logo.jpg" alt="VENTURA" className="w-full object-contain" style={{ maxWidth: 120 }} />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={onClose}
                className={`sidebar-item ${active ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className={active ? 'text-[#CCFF00]' : 'text-[#A0A0A0]'}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-6 border-t border-neutral-100 pt-4">
          <div className="mb-3 px-2">
            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mb-0.5">Conectado como</p>
            <p className="text-sm text-neutral-700 font-medium truncate flex items-center gap-2">
              <User className="w-4 h-4" />
              {user?.name || 'Usuário'}
            </p>
            <p className="text-xs text-neutral-400 capitalize mt-1">
              {user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gerente' : 'Usuário'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-150 cursor-pointer text-neutral-500 hover:text-red-600 hover:bg-red-50 font-medium text-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>Sair</span>
          </button>
          <p className="text-[11px] text-neutral-300 text-center mt-4">© 2026 Ventura Luz e Efeitos</p>
        </div>
      </aside>

      <aside className="fixed left-0 top-0 h-dvh w-64 bg-black border-r border-[rgba(255,255,255,0.08)] flex-col overflow-y-auto overflow-x-hidden z-40 hidden md:flex">
        <div className="px-6 pt-4 pb-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-center">
          <img src="/logo.jpg" alt="VENTURA" className="w-full object-contain" style={{ maxWidth: 140 }} />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`sidebar-item ${active ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className={active ? 'text-[#CCFF00]' : 'text-[#A0A0A0]'}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-6 border-t border-[rgba(255,255,255,0.08)] pt-4">
          <div className="mb-3 px-2">
            <p className="text-[10px] text-[#A0A0A0] font-medium uppercase tracking-wider mb-0.5">Conectado como</p>
            <p className="text-sm text-white font-medium truncate flex items-center gap-2">
              <User className="w-4 h-4" />
              {user?.name || 'Usuário'}
            </p>
            <p className="text-xs text-[#606060] capitalize mt-1">
              {user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gerente' : 'Usuário'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-150 cursor-pointer text-[#A0A0A0] hover:text-[#FF4444] hover:bg-[rgba(255,68,68,0.1)] font-medium text-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>Sair</span>
          </button>
          <p className="text-[11px] text-[#606060] text-center mt-4">© 2026 Ventura Luz e Efeitos</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;