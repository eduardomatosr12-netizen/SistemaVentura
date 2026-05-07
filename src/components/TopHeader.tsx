import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, X, User, MessageSquare, Calendar as CalendarIcon, Clock, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCRM } from '../contexts/CRMContext'

interface TopHeaderProps {
  onMenuClick?: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/crm/painel': { title: 'Painel', subtitle: 'Visão geral das oportunidades' },
  '/crm/Orçamentos': { title: 'Orçamentos', subtitle: 'Gestão de contatos e funil' },
  '/crm/pipeline': { title: 'Pipeline', subtitle: 'Progresso das oportunidades' },
  '/crm/calendario': { title: 'Calendário', subtitle: 'Compromissos e agendamentos' },
  '/crm/importar': { title: 'Importar', subtitle: 'Importação de dados externos' },
  '/crm/integracoes': { title: 'Integrações', subtitle: 'Conexões com outras plataformas' },
  '/financeiro': { title: 'Financeiro', subtitle: 'Receitas, despesas e fluxo de caixa' },
  '/tarefas': { title: 'Tarefas', subtitle: 'Atividades e to-dos do dia' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Preferências da aplicação' },
};

const TopHeader = ({ onMenuClick }: TopHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { searchTerm, setSearchTerm, notifications, markNotificationsAsRead } = useCRM();
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const route = routeTitles[location.pathname] ?? { title: 'Universo Axium', subtitle: '' };

  const hasUnread = notifications.some(n => !n.isRead);

  const userDisplayName = user?.fullName || user?.email?.split('@')[0] || 'Usuário';
  const initials = userDisplayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleToggleNotifications = () => {
    if (!isNotificationsOpen) {
      markNotificationsAsRead();
    }
    setIsNotificationsOpen(!isNotificationsOpen);
  };

  return (
    <header className="sticky top-0 z-40 bg-black/70 backdrop-blur-md border-b border-[#1a1a1a] px-3 md:px-8 py-2 md:py-4 flex items-center justify-between transition-all duration-300">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-md hover:bg-[#222] md:hidden"
        aria-label="Abrir menu"
      >
          <Menu className="w-5 h-5 text-neutral-400" />
      </button>
      
      <div>
          <h2 className="text-base md:text-lg font-black text-white tracking-tight leading-none">{route.title}</h2>
        {route.subtitle && (
          <p className="text-[10px] md:text-xs text-neutral-400 font-medium mt-0.5">{route.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Notification bell */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={handleToggleNotifications}
            className={`relative p-2 rounded-md transition-all ${isNotificationsOpen ? 'bg-[#222] text-[#B5FF03]' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}
          >
            <Bell className="w-4 h-4" strokeWidth={2} />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#B5FF03] rounded-full ring-2 ring-black" />
            )}
          </button>

          {/* Notifications Panel */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
               <div className="px-6 py-4 border-b border-[#333] flex justify-between items-center bg-[#111]">
                 <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Notificações</h3>
                 <span className="text-[9px] font-black bg-[#222] text-neutral-400 px-2 py-0.5 rounded uppercase">Recentes</span>
               </div>
               <div className="max-h-[360px] overflow-y-auto divide-y divide-[#222]">
                 {notifications.length > 0 ? (
                   notifications.map((n) => (
                     <div key={n.id} className={`p-5 hover:bg-[#222] transition-colors cursor-pointer group ${!n.isRead ? 'bg-[#222]/50' : ''}`}>
                       <div className="flex gap-4">
                         <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                           n.type === 'lead' ? 'bg-blue-900/30 text-blue-400' : 
                           n.type === 'meeting' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                         }`}>
                           {n.type === 'lead' ? <User size={14} /> : 
                            n.type === 'meeting' ? <CalendarIcon size={14} /> : <MessageSquare size={14} />}
                         </div>
                         <div className="space-y-1">
                           <p className="text-xs font-black text-white leading-tight group-hover:underline">{n.title}</p>
                           <p className="text-[11px] text-neutral-400 font-bold leading-relaxed">{n.description}</p>
                           <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-black uppercase tracking-tight mt-2">
                             <Clock size={10} strokeWidth={3} />
                             {n.time}
                           </div>
                         </div>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="p-12 text-center">
                     <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest italic">Nenhuma notificação</p>
                   </div>
                 )}
               </div>
               <div className="px-6 py-3 bg-[#111] border-t border-[#333] text-center">
                 <button className="text-[9px] font-black text-neutral-500 hover:text-white uppercase tracking-[2px] transition-colors">Limpar tudo</button>
               </div>
             </div>
          )}
        </div>

        {/* Avatar */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-8 h-8 rounded-full bg-[#B5FF03] text-black flex items-center justify-center text-xs font-bold hover:bg-[#a1e600] transition-colors shrink-0 shadow-sm"
            title={user?.email}
          >
            {initials}
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
               <div className="px-4 py-3 border-b border-[#333]">
                 <p className="text-xs font-black text-white truncate">{userDisplayName}</p>
                 <p className="text-[10px] text-neutral-400 truncate">{user?.email}</p>
               </div>
               <div className="py-1">
                 <button
                   onClick={() => { setIsUserMenuOpen(false); navigate('/configuracoes'); }}
                   className="w-full px-4 py-2.5 text-left text-xs font-medium text-neutral-300 hover:bg-[#222] flex items-center gap-3 transition-colors"
                 >
                   <User className="w-4 h-4" />
                   Perfil
                 </button>
                 <button
                   onClick={handleLogout}
                   className="w-full px-4 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-[#222] flex items-center gap-3 transition-colors"
                 >
                   <LogOut className="w-4 h-4" />
                   Sair
                 </button>
               </div>
             </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
