import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Upload } from 'lucide-react';

const CRMSubmenu = () => {
  const location = useLocation();

  const crmSubItems = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard, path: '/crm/painel' },
    { id: 'orcamentos', label: 'Clientes', icon: Users, path: '/crm/orcamentos' },
    { id: 'calendario', label: 'Calendário', icon: Calendar, path: '/crm/calendario' },
    { id: 'importar', label: 'Importar', icon: Upload, path: '/crm/importar' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div
      className="
        bg-black/70 backdrop-blur-md
        border-b border-[#333]
        px-2 md:px-8
      "
    >
      <div className="flex items-center gap-1 overflow-x-auto scroll-smooth scrollbar-hide" style={{ touchAction: 'pan-x' }}>
        {crmSubItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                relative whitespace-nowrap flex items-center gap-1 md:gap-2
                px-3 md:px-3 py-3 md:py-3.5 min-h-[44px] text-xs md:text-sm font-medium transition-colors duration-150
                ${active
                  ? 'text-[#B5FF03] font-semibold'
                  : 'text-neutral-400 hover:text-white'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B5FF03] rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CRMSubmenu;
