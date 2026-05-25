import { useState, useMemo } from 'react';
import { Calendar, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, LayoutDashboard, X } from 'lucide-react';
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

const statusLabel: Record<string, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
  realizado: 'Realizado',
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'confirmado': return '#B5FF03';
    case 'pendente': return '#f59e0b';
    case 'cancelado': return '#ef4444';
    case 'realizado': return '#3b82f6';
    default: return '#6b7280';
  }
};

const statusBg: Record<string, string> = {
  confirmado: 'bg-[#B5FF03]',
  pendente: 'bg-[#f59e0b]',
  cancelado: 'bg-[#ef4444]',
  realizado: 'bg-[#3b82f6]',
};

const CRMDashboard = () => {
  const { events } = useCRM();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError } = useActivityLogs();
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const displayLogs = useMemo(() => {
    return activityLogs.slice(0, 10).filter(log => log?.id && log?.acao);
  }, [activityLogs]);

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

  const upcomingEvents = useMemo(() => {
    return safeEvents
      .filter(e => e.date && new Date(e.date + 'T12:00:00') >= new Date())
      .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
      .slice(0, 5);
  }, [safeEvents]);

  const handleDayClick = (day: number) => {
    const events = getEventsForDay(day);
    if (events.length === 0) return;
    setSelectedDayEvents(events);
    const dateObj = new Date(today.getFullYear(), today.getMonth(), day);
    setSelectedDate(dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }));
  };

  const closeModal = () => {
    setSelectedDayEvents(null);
    setSelectedDate(null);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

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
            const hasEvents = dayEvents.length > 0;
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={!hasEvents}
                className={`h-7 flex items-center justify-center text-[10px] font-bold rounded-full relative
                  ${isToday ? 'bg-[#B5FF03] text-black' : hasEvents ? 'text-white hover:bg-[#222] cursor-pointer' : 'text-neutral-600 cursor-default'}
                  ${!hasEvents ? '' : 'transition-colors'}`}
              >
                {day}
                {hasEvents && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayEvents.slice(0, 3).map((ev, idx) => (
                      <div key={idx} className="w-1 h-1 rounded-full" style={{ backgroundColor: getStatusColor(ev.status) }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-[#222]">
          {Object.entries(statusLabel).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${statusBg[key]}`} />
              <span className="text-[8px] text-neutral-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Upcoming Events */}
        <h4 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-3">Próximos Eventos</h4>
        <div className="space-y-2">
          {upcomingEvents.map(event => (
            <button
              key={event.id}
              onClick={() => {
                setSelectedDayEvents([event]);
                setSelectedDate(
                  event.date
                    ? new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'
                );
              }}
              className="w-full text-left flex items-start gap-2 p-2 rounded-md hover:bg-[#1a1a1a] transition-colors group"
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
            </button>
          ))}
          {upcomingEvents.length === 0 && (
            <p className="text-[10px] text-neutral-600 text-center py-2 italic">Nenhum evento futuro</p>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={closeModal}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">
                Eventos — {selectedDate}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-[#222] rounded-md transition-colors">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="bg-[#111] border border-[#222] rounded-lg p-4 space-y-3">
                  {/* Status badge */}
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{event.title || 'Evento'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${event.status ? statusBg[event.status] : 'bg-[#333]'} ${event.status === 'confirmado' ? 'text-black' : 'text-white'}`}>
                      {event.status ? statusLabel[event.status] : '—'}
                    </span>
                  </div>

                  {/* Client info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {event.client && (
                      <div className="col-span-2">
                        <span className="text-neutral-500">Cliente:</span>{' '}
                        <span className="text-white font-medium">{event.client}</span>
                      </div>
                    )}
                    {event.clientPhone && (
                      <div>
                        <span className="text-neutral-500">Telefone:</span>{' '}
                        <span className="text-white">{event.clientPhone}</span>
                      </div>
                    )}
                    {event.clientEmail && (
                      <div>
                        <span className="text-neutral-500">E-mail:</span>{' '}
                        <span className="text-white">{event.clientEmail}</span>
                      </div>
                    )}
                    {event.clientCpf && (
                      <div>
                        <span className="text-neutral-500">CPF:</span>{' '}
                        <span className="text-white">{event.clientCpf}</span>
                      </div>
                    )}
                    {event.eventType && (
                      <div>
                        <span className="text-neutral-500">Tipo:</span>{' '}
                        <span className="text-[#B5FF03] font-bold">{event.eventType}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-500">Data:</span>{' '}
                      <span className="text-white">{formatDate(event.date)}</span>
                    </div>
                    {event.time && (
                      <div>
                        <span className="text-neutral-500">Horário:</span>{' '}
                        <span className="text-white">{event.time}</span>
                      </div>
                    )}
                    {event.local && (
                      <div className="col-span-2">
                        <span className="text-neutral-500">Local:</span>{' '}
                        <span className="text-white">{event.local}</span>
                      </div>
                    )}
                  </div>

                  {/* Three milestones */}
                  <div className="border-t border-[#222] pt-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Marcos do Evento</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#1a1a1a] rounded-md p-2 text-center">
                        <p className="text-[8px] text-neutral-500 uppercase tracking-wider">Evento</p>
                        <p className="text-[11px] text-white font-bold mt-0.5">{formatDate(event.date)}</p>
                      </div>
                      <div className="bg-[#1a1a1a] rounded-md p-2 text-center">
                        <p className="text-[8px] text-neutral-500 uppercase tracking-wider">Montagem</p>
                        <p className="text-[11px] text-white font-bold mt-0.5">{formatDate(event.dataMontagem)}</p>
                      </div>
                      <div className="bg-[#1a1a1a] rounded-md p-2 text-center">
                        <p className="text-[8px] text-neutral-500 uppercase tracking-wider">Desmontagem</p>
                        <p className="text-[11px] text-white font-bold mt-0.5">{formatDate(event.dataDesmontagem)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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