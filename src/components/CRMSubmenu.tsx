import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Calendar, Upload, Zap } from 'lucide-react';

const CRMSubmenu = () => {
  const location = useLocation();

  const crmSubItems = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard, path: '/crm/painel' },
    { id: 'leads', label: 'Leads', icon: Users, path: '/crm/leads' },
    { id: 'pipeline', label: 'Pipeline', icon: GitBranch, path: '/crm/pipeline' },
    { id: 'calendario', label: 'Calendário', icon: Calendar, path: '/crm/calendario' },
    { id: 'importar', label: 'Importar', icon: Upload, path: '/crm/importar' },
    { id: 'integracoes', label: 'Integrações', icon: Zap, path: '/crm/integracoes' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div
      className="
        bg-white/70 backdrop-blur-md
        border-b border-neutral-200/60
        px-2 md:px-8
      "
    >
      <div className="flex items-center gap-1 overflow-x-auto scroll-smooth scrollbar-hide">
        {crmSubItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                relative whitespace-nowrap flex items-center gap-1 md:gap-2
                px-2 md:px-3 py-2 md:py-3.5 text-xs md:text-sm font-medium transition-colors duration-150
                ${active
                  ? 'text-black font-semibold'
                  : 'text-neutral-400 hover:text-neutral-700'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {/* Active underline */}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CRMSubmenu;
