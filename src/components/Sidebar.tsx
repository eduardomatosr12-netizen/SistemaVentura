import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, DollarSign, CheckCircle, Settings, LogOut, X, User } from 'lucide-react';
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
    { id: 'crm', label: 'CRM', icon: BarChart3, path: '/crm', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/financeiro', allowedRoles: ['admin', 'manager'] as const },
    { id: 'tarefas', label: 'Tarefas', icon: CheckCircle, path: '/tarefas', allowedRoles: ['admin', 'manager', 'user'] as const },
    { id: 'configuracoes', label: 'Configurações', icon: Settings, path: '/configuracoes', allowedRoles: ['admin'] as const },
  ];

  const visibleMenuItems = mainMenuItems.filter(item => 
    hasPermission && item.allowedRoles.includes(user?.role as any)
  );

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed md:hidden left-0 top-0 h-screen w-[85%] max-w-80 bg-white border-r border-neutral-200 flex-col overflow-y-auto z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-neutral-100"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5 text-neutral-600" />
        </button>
        
        <div className="px-4 pt-8 pb-6 border-b border-neutral-100">
          <img
            src="/logo.png"
            alt="Universo Axium"
            className="h-10 w-auto object-contain"
          />
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
                <span>{item.label}</span>
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
          <p className="text-[11px] text-neutral-300 text-center mt-4">© 2026 Universo Axium</p>
        </div>
      </aside>

      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-neutral-200 flex-col overflow-y-auto z-40 hidden md:flex">
        <div className="px-6 pt-8 pb-6 border-b border-neutral-100">
          <img
            src="/logo.png"
            alt="Universo Axium"
            className="h-10 w-auto object-contain"
          />
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
                <span>{item.label}</span>
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
          <p className="text-[11px] text-neutral-300 text-center mt-4">© 2026 Universo Axium</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;