import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, Package, Settings, LogOut, X, LayoutDashboard, Phone } from 'lucide-react';
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
  ];

  const visibleMenuItems = !hasPermission ? mainMenuItems : mainMenuItems.filter(item =>
    user?.role ? item.allowedRoles.includes(user.role) : false
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

  const displayName = user?.name || 'Usuário';
  const initials = displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gerente' : 'Usuário';

  const menuContent = (
    <>
      {/* Avatar + User */}
      <div className="px-4 pt-5 pb-5 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#CDFF00] text-black flex items-center justify-center text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-bold truncate">{displayName}</p>
            <p className="text-[11px] text-[#A0A0A0] capitalize mt-0.5">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-3">
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
              <Icon className="w-6 h-6 shrink-0" strokeWidth={2} />
              <span className={active ? 'text-black font-black' : 'text-[#A0A0A0]'}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sair */}
      <div className="px-4 pb-6 border-t border-[#2d2d2d] pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer text-white hover:text-[#ff4444] font-medium text-sm"
        >
          <LogOut className="w-6 h-6 shrink-0" strokeWidth={2} />
          <span>Sair</span>
        </button>
        <p className="text-[11px] text-[#606060] text-center mt-4">© 2026 Ventura Luz e Efeitos</p>
      </div>
    </>
  );

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[65] md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Mobile drawer */}
      <aside className={`fixed md:hidden left-0 top-0 h-dvh w-[220px] bg-black border-r border-[#2d2d2d] flex flex-col overflow-y-auto overflow-x-hidden z-[70] transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-[#222]"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5 text-[#A0A0A0] hover:text-[#CDFF00]" />
        </button>
        {menuContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-dvh w-[220px] bg-black border-r border-[#2d2d2d] flex-col overflow-y-auto overflow-x-hidden z-40 hidden md:flex">
        {menuContent}
      </aside>
    </>
  );
};

export default Sidebar;