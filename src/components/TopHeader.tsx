import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, Calendar as CalendarIcon, Clock, Menu, LogOut, UserPlus, FileText, CheckCircle, Package, DollarSign, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../hooks/useNotifications';

interface TopHeaderProps {
  onMenuClick?: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/crm/painel': { title: 'Painel', subtitle: 'Visão geral das oportunidades' },
  '/crm/orcamentos': { title: 'Clientes', subtitle: 'Gestão de contatos e funil' },
  '/crm/calendario': { title: 'Calendário', subtitle: 'Compromissos e agendamentos' },
  '/crm/importar': { title: 'Importar', subtitle: 'Importação de dados externos' },
  '/financeiro': { title: 'Financeiro', subtitle: 'Receitas, despesas e fluxo de caixa' },
  '/tarefas': { title: 'Controle de Estoque', subtitle: 'Gerencie seus itens, categorias e fornecedores.' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Preferências da aplicação' },
  '/configuracoes/templates-whatsapp': { title: 'Templates WhatsApp', subtitle: 'Gerencie modelos de mensagens para WhatsApp' },
};

const notificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'novo_cliente': return UserPlus;
    case 'orcamento_pendente': return FileText;
    case 'evento_proximo': return CalendarIcon;
    case 'fechamento': return CheckCircle;
    case 'equipamento': return Package;
    case 'financeiro': return DollarSign;
    default: return Bell;
  }
};

const TopHeader = ({ onMenuClick }: TopHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, dismissAll } = useNotifications();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const route = routeTitles[location.pathname] ?? { title: 'Ventura Luz e Efeitos', subtitle: '' };

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

  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current.clear();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    navigate('/login');
  }, [logout, navigate]);

  const handleNotificationClick = useCallback((n: AppNotification) => {
    markAsRead(n.id);
    setIsNotificationsOpen(false);
    navigate(n.link);
  }, [markAsRead, navigate]);

  const handleDismiss = useCallback((id: string) => {
    setLeavingIds(prev => new Set(prev).add(id));
    const timeoutId = setTimeout(() => {
      dismissNotification(id);
      setLeavingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      timeoutRefs.current.delete(id);
    }, 300);
    timeoutRefs.current.set(id, timeoutId);
  }, [dismissNotification]);

  const handleClearAll = useCallback(() => {
    const ids = notifications.map(n => n.id);
    setLeavingIds(new Set(ids));
    const timeoutId = setTimeout(() => {
      dismissAll();
      setLeavingIds(new Set());
      timeoutRefs.current.clear();
    }, 300);
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current.clear();
    timeoutRefs.current.set('clear-all', timeoutId);
  }, [notifications, dismissAll]);

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
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative p-2 rounded-md transition-all ${isNotificationsOpen ? 'bg-[#222] text-[#B5FF03]' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}
          >
            <Bell className="w-4 h-4" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#B5FF03] text-black text-[9px] font-black flex items-center justify-center rounded-full ring-2 ring-black">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Panel */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-16px)] bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
               <div className="px-6 py-4 border-b border-[#333] flex justify-between items-center bg-[#111]">
                 <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Notificações</h3>
                 <span className="text-[9px] font-black bg-[#222] text-neutral-400 px-2 py-0.5 rounded uppercase">{unreadCount} nova{unreadCount !== 1 ? 's' : ''}</span>
               </div>
               <div className="max-h-[360px] overflow-y-auto divide-y divide-[#222222]">
                 {notifications.length > 0 ? (
                   notifications.map((n) => {
                     const Icon = notificationIcon(n.type);
                     const isLeaving = leavingIds.has(n.id);
                     return (
                       <div
                         key={n.id}
                         onClick={() => !isLeaving && handleNotificationClick(n)}
                         className={`relative p-5 hover:bg-[#222] transition-all duration-300 cursor-pointer group ${!n.isRead ? 'bg-[#222]/50' : ''} ${isLeaving ? 'opacity-0 -translate-x-4 scale-95 pointer-events-none' : 'opacity-100 translate-x-0 scale-100'}`}
                       >
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}
                            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-red-900/50 text-neutral-500 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 z-10"
                          >
                           <X size={10} strokeWidth={3} />
                         </button>
                         <div className="flex gap-4">
                           <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-[#111] text-[#B5FF03] border border-[#222222]">
                             <Icon size={14} />
                           </div>
                           <div className="space-y-1 flex-1 min-w-0">
                             <p className="text-xs font-black text-white leading-tight group-hover:underline pr-4">{n.title}</p>
                             <p className="text-[11px] text-neutral-400 font-bold leading-relaxed">{n.description}</p>
                             <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-black uppercase tracking-tight mt-2">
                               <Clock size={10} strokeWidth={3} />
                               {n.time}
                             </div>
                           </div>
                         </div>
                       </div>
                     );
                   })
                 ) : (
                   <div className="p-12 text-center">
                     <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest italic">Você não tem novas notificações no momento</p>
                   </div>
                 )}
               </div>
               {notifications.length > 0 && (
                 <div className="px-6 py-3 bg-[#111] border-t border-[#333] text-center">
                   <button onClick={handleClearAll} className="text-[9px] font-black text-neutral-500 hover:text-white uppercase tracking-[2px] transition-colors">Limpar tudo</button>
                 </div>
               )}
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
