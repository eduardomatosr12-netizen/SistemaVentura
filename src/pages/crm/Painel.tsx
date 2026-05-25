import { useMemo } from 'react';
import { Calendar, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCRM } from '../../contexts/CRMContext';
import type { CalendarEvent } from '../../contexts/CRMContext';
import { useActivityLogs } from '../../contexts/ActivityContext';
import { Link } from 'react-router-dom';

const ACTION_ICONS: Record<string, LucideIcon> = {
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

const CRMDashboard = () => {
  const { events } = useCRM();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError } = useActivityLogs();

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
      {/* Header section */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
          <LayoutDashboard className="text-[#B5FF03]" size={32} />
          Página Principal
        </h1>
        <p className="text-neutral-400 text-xs md:text-sm">Bem-vindo ao painel de controle da Ventura Luz e Efeitos.</p>
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