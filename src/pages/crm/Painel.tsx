import { useEffect, useState, useMemo, useCallback } from 'react';
import { Users, Calendar, MessageSquare, Clock, UserX, CheckCircle, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, FileText, Filter, XCircle, LayoutDashboard, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCRM, type Lead } from '../../contexts/CRMContext';
import type { CalendarEvent } from '../../contexts/CRMContext';
import { useActivityLogs } from '../../contexts/ActivityContext';
import { useFilters } from '../../contexts/FilterContext';
import { Link } from 'react-router-dom';

// Dados iniciais como fallback
const INITIAL_Orçamentos: Lead[] = [
  { id: '1', name: 'João Silva', niche: 'Odontologia', whatsapp: '11 99999-9999', email: 'joao@example.com', instagram: '@joaosilva', stage: 'Reunião Agendada', firstContact: '2026-04-01', closingDate: '2026-04-30', followUpReminder: '2026-04-22', address: 'São Paulo - SP', notes: 'Cliente interessado.', value: 'R$ 5.000' },
  { id: '2', name: 'Maria Santos', niche: 'Dermatologia', whatsapp: '11 88888-8888', email: 'maria@example.com', instagram: '@mariasan', stage: 'Novos Orçamentos', firstContact: '2026-04-10', closingDate: '', followUpReminder: '2026-04-25', address: 'Rio de Janeiro - RJ', notes: '', value: 'R$ 8.000' },
  { id: '3', name: 'Pedro Oliveira', niche: 'Clínica Geral', whatsapp: '11 77777-7777', email: 'pedro@example.com', instagram: '@pedrooli', stage: 'Proposta Enviada', firstContact: '2026-03-20', closingDate: '2026-05-15', followUpReminder: '2026-04-23', address: 'Belo Horizonte - MG', notes: 'Aguardando aprovação.', value: 'R$ 12.000' },
  { id: '4', name: 'Clínica Sorriso', niche: 'Odontologia', whatsapp: '11 5555-5555', email: 'contato@sorriso.com', instagram: '@clinicasorriso', stage: 'Contrato Fechado', firstContact: '2026-03-10', closingDate: '2026-04-15', followUpReminder: '', address: 'Curitiba - PR', notes: 'Contrato fechado!', value: 'R$ 15.000' },
];

const STAGES = [
  'Novos Orçamentos',
  'Primeiro Contato',
  'Contato Ativo',
  'Reunião Agendada',
  'Follow Up',
  'Proposta Enviada',
  'Contrato Fechado',
  'Perdido'
] as const;

interface Stat {
  title: string;
  value: string;
  icon: LucideIcon;
  stageFilter?: string;
}

interface ActionIconConfig {
  [key: string]: LucideIcon;
}

const ACTION_ICONS: ActionIconConfig = {
  lead_criado: UserPlus,
  lead_movido: ArrowRight,
  lead_atualizado: ArrowRight,
  tarefa_concluida: CheckSquare,
};

const formatRelativeTime = (timestamp: string): string => {
  if (!timestamp || typeof timestamp !== 'string') return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
};

const sanitizeDescription = (desc: string | null | undefined): string => {
  if (!desc || typeof desc !== 'string') return '';
  return desc.trim().slice(0, 500);
};

const filterOrçamentos = (Orçamentos: Lead[], filters: { stages?: string[]; niches?: string[]; dateFilter?: string }): Lead[] => {
  const { stages = [], niches = [], dateFilter = '' } = filters;
  const hasActiveFilters = stages.length > 0 || niches.length > 0 || dateFilter !== '';
  if (!hasActiveFilters) return Orçamentos;
  return (Orçamentos || []).filter(lead => {
    if (stages.length > 0 && !stages.includes(lead.stage)) return false;
    if (niches.length > 0 && !niches.includes(lead.niche)) return false;
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateFilter === 'today') {
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate.toDateString() === today.toDateString();
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate >= weekAgo;
      }
      if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate >= monthAgo;
      }
    }
    return true;
  });
};

const calculateStats = (Orçamentos: Lead[], icons: typeof CHART_ICONS) => {
  const stats: Stat[] = [
    { title: 'Total de Orçamentos', value: Orçamentos.length.toString(), icon: icons.Users },
    { title: 'Reuniões', value: Orçamentos.filter(l => l.stage === 'Reunião Agendada').length.toString(), icon: icons.Calendar, stageFilter: 'Reunião Agendada' },
    { title: 'Contatos Ativos', value: Orçamentos.filter(l => l.stage === 'Contato Ativo').length.toString(), icon: icons.MessageSquare, stageFilter: 'Contato Ativo' },
    { title: 'Follow-ups', value: Orçamentos.filter(l => l.stage === 'Follow Up').length.toString(), icon: icons.Clock, stageFilter: 'Follow Up' },
    { title: 'Propostas Enviadas', value: Orçamentos.filter(l => l.stage === 'Proposta Enviada').length.toString(), icon: icons.FileText, stageFilter: 'Proposta Enviada' },
    { title: 'Orçamentos Perdidos', value: Orçamentos.filter(l => l.stage === 'Perdido').length.toString(), icon: icons.UserX, stageFilter: 'Perdido' },
    { title: 'Fechados', value: Orçamentos.filter(l => l.stage === 'Contrato Fechado').length.toString(), icon: icons.CheckCircle, stageFilter: 'Contrato Fechado' },
  ];
  return stats;
};

const CHART_ICONS = { Users, Calendar, MessageSquare, Clock, FileText, UserX, CheckCircle };

const CRMDashboard = () => {
  const { Orçamentos: contextOrçamentos, events } = useCRM();
  const { filters, hasActiveFilters } = useFilters();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError, fetchActivityLogs } = useActivityLogs();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fallback defensivo: usar dados locais se contexto estiver vazio
  const Orçamentos = useMemo(() => {
    if (contextOrçamentos && Array.isArray(contextOrçamentos) && contextOrçamentos.length > 0) {
      return contextOrçamentos;
    }
    return INITIAL_Orçamentos;
  }, [contextOrçamentos]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    fetchActivityLogs(15).catch(err => {
      console.error('Error fetching activity logs:', err);
    });
  }, [fetchActivityLogs]);

  const filteredOrçamentos = useMemo(() => filterOrçamentos(Orçamentos, {
    stages: filters.stages,
    niches: filters.niches,
    dateFilter: filters.dateFilter,
  }), [Orçamentos, filters]);

  const stats = useMemo(() => calculateStats(filteredOrçamentos, CHART_ICONS), [filteredOrçamentos]);

  const displayLogs = useMemo(() => {
    return activityLogs.slice(0, 10).filter(log => log?.id && log?.acao);
  }, [activityLogs]);

  // Calendar widget helpers
  const today = new Date();
  const safeEvents = Array.isArray(events) ? events : [];
  
  const getEventsForDay = (day: number) => {
    return safeEvents.filter(e => {
      if (!e?.date) return false;
      const d = new Date(e.date + 'T12:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getDate() === day && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  };

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmado': return '#B5FF03';
      case 'pendente': return '#f59e0b';
      case 'cancelado': return '#ef4444';
      case 'realizado': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const upcomingEvents = useMemo(() => {
    return safeEvents
      .filter(e => e.date && new Date(e.date + 'T12:00:00') >= new Date())
      .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
      .slice(0, 5);
  }, [safeEvents]);

  return (
    <div className="relative min-h-screen bg-black">
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute top-14 left-4 w-[280px] bg-[#111] border border-[#333] rounded-xl shadow-xl z-50 p-3"
            role="dialog"
            aria-label="Filtros ativos"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Filtros</span>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-1 hover:bg-[#222] rounded-md"
                aria-label="Fechar filtros"
              >
                <XCircle size={14} className="text-neutral-400 hover:text-[#B5FF03]" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">Aplique filtros na aba Contatos para filtrar dados aqui.</p>
          </div>
        </>
      )}

      {/* Header section */}
      <div className="mb-4 md:mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 whitespace-nowrap flex items-center gap-3">
            <LayoutDashboard className="text-[#B5FF03]" size={32} />
            Página Principal
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm">Bem-vindo ao painel de controle da Ventura Luz e Efeitos.</p>
        </div>
        <div className="relative group">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters ? 'bg-[#111] text-[#B5FF03] border-[#333]' : 'bg-transparent border-transparent text-neutral-400 hover:text-[#B5FF03] hover:bg-[#111]'}`}
          >
            <Filter size={16} strokeWidth={hasActiveFilters ? 2.5 : 1.5} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111] text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Filtros
          </span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3 lg:gap-4 mb-6 md:mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[#111] border border-[#333] rounded-md p-3 md:p-5 hover:border-[#B5FF03] transition-all shadow-sm">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="w-6 md:w-8 h-6 md:h-8 rounded-md bg-[#222] flex items-center justify-center">
                  <Icon size={14} className="text-[#B5FF03] md:w-4 md:h-4" />
                </div>
                <p className="text-white text-[9px] md:text-[11px] font-bold uppercase tracking-widest leading-none">{stat.title}</p>
              </div>
              <p className="text-2xl md:text-3xl font-black text-[#B5FF03]">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Mini Calendário Widget */}
        <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-[#B5FF03] uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} />
              Calendário
            </h3>
            <Link to="/calendario" className="text-[9px] text-neutral-400 hover:text-white uppercase tracking-wider font-bold">
              Ver todos
            </Link>
          </div>

          {/* Mini Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5 mb-4">
            {dayNames.map(d => (
              <div key={d} className="text-center text-[8px] text-neutral-500 font-bold uppercase py-1">
                {d[0]}
              </div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = day === today.getDate();
              return (
                <div
                  key={day}
                  className={`h-7 flex items-center justify-center text-[10px] font-bold rounded-full relative cursor-default
                    ${isToday ? 'bg-[#B5FF03] text-black' : dayEvents.length > 0 ? 'text-white' : 'text-neutral-600'}`}
                >
                  {day}
                  {dayEvents.length > 0 && !isToday && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <div key={idx} className="w-1 h-1 rounded-full" style={{ backgroundColor: getStatusColor(ev.status) }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-[#222]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#B5FF03]" />
              <span className="text-[8px] text-neutral-500">Confirmado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              <span className="text-[8px] text-neutral-500">Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span className="text-[8px] text-neutral-500">Cancelado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span className="text-[8px] text-neutral-500">Realizado</span>
            </div>
          </div>

          {/* Upcoming Events */}
          <h4 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-3">Próximos Eventos</h4>
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <Link
                key={event.id}
                to="/calendario"
                className="flex items-start gap-2 p-2 rounded-md hover:bg-[#1a1a1a] transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: getStatusColor(event.status) }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-white truncate group-hover:underline">{event.title || 'Sem título'}</p>
                  <div className="flex items-center gap-2 text-[8px] text-neutral-500">
                    <span>{event.eventType || 'Evento'}</span>
                    <span>•</span>
                    <span>{event.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
                    {event.time && <><span>•</span><span>{event.time}</span></>}
                  </div>
                </div>
              </Link>
            ))}
            {upcomingEvents.length === 0 && (
              <p className="text-[10px] text-neutral-600 text-center py-2 italic">Nenhum evento futuro</p>
            )}
          </div>
        </div>

      {/* Atividades Recentes */}
      <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-4 h-4 text-[#B5FF03]" aria-hidden="true" />
          <h2 className="text-lg md:text-xl font-bold text-white">Atividades Recentes</h2>
        </div>
        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#B5FF03]/20 border-t-[#B5FF03] rounded-full animate-spin" />
            <span className="ml-2 text-sm text-neutral-400">Carregando atividades...</span>
          </div>
        ) : fetchActivityLogsError ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-md" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
            <p className="text-sm text-red-600">{fetchActivityLogsError}</p>
          </div>
        ) : displayLogs.length === 0 ? (
          <p className="text-neutral-400 text-xs">Nenhuma atividade registrada.</p>
        ) : (
          <div className="space-y-3">
            {displayLogs.map((log) => {
              const Icon = ACTION_ICONS[log.acao] || Activity;
              return (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-[#B5FF03]" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-white leading-snug">{sanitizeDescription(log.descricao)}</p>
                    <p className="text-[10px] md:text-xs text-neutral-400 font-medium mt-0.5">há {formatRelativeTime(log.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CRMDashboard;