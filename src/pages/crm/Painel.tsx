import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Calendar, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, LayoutDashboard, X, ChevronLeft, ChevronRight, ChevronDown, Search, User, Phone, Mail, CreditCard, CalendarDays, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCRM } from '../../contexts/CRMContext';
import type { CalendarEvent, Lead } from '../../contexts/CRMContext';
import { useActivityLogs } from '../../contexts/ActivityContext';

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

const EVENT_TYPES = [
  { value: 'Aniver', label: 'Aniver (Aniversário)' },
  { value: 'Casam', label: 'Casam (Casamento)' },
  { value: 'Corporativo', label: 'Corporativo' },
  { value: 'Privado', label: 'Privado' },
  { value: 'Outros', label: 'Outros' },
];

const CRMDashboard = () => {
  const { events, Orçamentos, addLead, addEvent } = useCRM();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError } = useActivityLogs();
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'novo_cliente' | 'novo_evento'>('novo_cliente');
  const [createDate, setCreateDate] = useState('');
  const [formData, setFormData] = useState({
    name: '', whatsapp: '', email: '', cpf: '',
    eventType: '', date: '', time: '',
  });
  const [selectedClientId, setSelectedClientId] = useState('');

  // Custom dropdown state
  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const eventTypeRef = useRef<HTMLDivElement>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eventTypeRef.current && !eventTypeRef.current.contains(e.target as Node)) {
        setEventTypeOpen(false);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return Orçamentos;
    const q = clientSearch.toLowerCase();
    return Orçamentos.filter(l =>
      l.name.toLowerCase().includes(q) || l.whatsapp.includes(q)
    );
  }, [clientSearch, Orçamentos]);

  const openCreateModal = (dateStr: string) => {
    setCreateDate(dateStr);
    setFormData(prev => ({ ...prev, date: dateStr, eventType: '' }));
    setSelectedClientId('');
    setClientSearch('');
    setCreateMode('novo_cliente');
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMode === 'novo_cliente') {
      const leadInput = {
        name: formData.name,
        niche: formData.eventType || 'Evento',
        whatsapp: formData.whatsapp,
        email: formData.email,
        instagram: '',
        stage: 'Novos Orçamentos',
        origin: 'evento',
        firstContact: formData.date || new Date().toISOString().split('T')[0],
        closingDate: '',
        followUpReminder: '',
        address: '',
        notes: '',
        value: '',
      };
      addLead(leadInput);
      addEvent({
        title: formData.eventType ? `${formData.eventType} - ${formData.name}` : formData.name,
        client: formData.name,
        clientPhone: formData.whatsapp,
        clientEmail: formData.email,
        clientCpf: formData.cpf,
        eventType: formData.eventType,
        date: formData.date,
        time: formData.time,
        status: 'pendente',
      });
    } else {
      const client = Orçamentos.find(l => l.id === selectedClientId);
      if (!client) return;
      addEvent({
        title: formData.eventType ? `${formData.eventType} - ${client.name}` : client.name,
        client: client.name,
        clientId: client.id,
        clientPhone: client.whatsapp,
        clientEmail: client.email,
        clientCpf: '',
        eventType: formData.eventType,
        date: formData.date,
        time: formData.time,
        status: 'pendente',
      });
    }
    setIsCreateOpen(false);
  };

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
      return d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const dayHeaders = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const upcomingEvents = useMemo(() => {
    return safeEvents
      .filter(e => e.date && new Date(e.date + 'T12:00:00') >= new Date())
      .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
      .slice(0, 10);
  }, [safeEvents]);

  const handleDayClick = (day: number) => {
    const events = getEventsForDay(day);
    const dateObj = new Date(viewYear, viewMonth, day);
    if (events.length === 0) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      openCreateModal(dateStr);
      return;
    }
    setSelectedDayEvents(events);
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

  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className="relative min-h-screen bg-black">
      {/* Header section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
          <LayoutDashboard className="text-[#B5FF03]" size={32} />
          Página Principal
        </h1>
        <p className="text-neutral-400 text-xs md:text-sm">Bem-vindo ao painel de controle da Ventura Luz e Efeitos.</p>
      </div>

      {/* Expanded Calendar Section */}
      <div className="bg-[#111] border border-[#333] rounded-2xl shadow-sm overflow-hidden">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6 border-b border-[#222]">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Calendário de Eventos</h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">Visualize e acompanhe seus compromissos agendados.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-1.5">
              <button onClick={prevMonth} className="p-1 hover:bg-[#222] rounded-md transition-colors">
                <ChevronLeft size={16} className="text-neutral-400" />
              </button>
              <span className="text-sm font-bold text-white min-w-[140px] text-center select-none">
                {monthNames[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-[#222] rounded-md transition-colors">
                <ChevronRight size={16} className="text-neutral-400" />
              </button>
            </div>
            <button
              onClick={() => openCreateModal(new Date().toISOString().split('T')[0])}
              className="rounded-full px-4 py-2 bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a1e600] transition-colors min-h-[44px]"
            >
              + CRIAR
            </button>
          </div>
        </div>

        {/* Legend bar */}
        <div className="flex flex-wrap items-center gap-4 px-4 md:px-6 py-3 border-b border-[#222] bg-[#0a0a0a]">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Status:</span>
          {Object.entries(statusLabel).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${statusBg[key]}`} />
              <span className="text-[10px] text-neutral-500 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row">
          {/* Left - Calendar Grid */}
          <div className="flex-1 p-4 md:p-6">
            <div className="grid grid-cols-7 bg-[#222] rounded-lg overflow-hidden">
              {/* Day headers */}
              {dayHeaders.map(d => (
                <div key={d} className="bg-[#111] text-center text-[9px] font-black uppercase tracking-widest text-neutral-400 py-2 px-1 border-b border-[#222]">
                  {d}
                </div>
              ))}
              {/* Empty offset cells */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-[#111] min-h-[90px] md:min-h-[110px] border-r border-b border-[#222]" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDay(day);
                const isToday = day === today.getDate() && isCurrentMonth;
                return (
                  <div
                    key={day}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleDayClick(day)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDayClick(day); }}
                    className={`min-h-[90px] md:min-h-[110px] p-1.5 text-left align-top border-r border-b border-[#222] select-none transition-colors
                      ${isToday ? 'bg-[#1a1a1a] ring-1 ring-inset ring-[#B5FF03]' : 'bg-[#111]'}
                      hover:bg-[#1a1a1a]`}
                    style={{ cursor: 'pointer !important', pointerEvents: 'auto !important' } as React.CSSProperties}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full mb-1
                      ${isToday ? 'bg-[#B5FF03] text-black' : 'text-neutral-400'}`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className="text-[8px] leading-tight px-1 py-0.5 rounded truncate font-medium text-white"
                          style={{ backgroundColor: ev.status ? getStatusColor(ev.status) + '25' : '#333', borderLeft: `2px solid ${getStatusColor(ev.status)}` }}
                        >
                          {ev.title || ev.client || ev.eventType || 'Evento'}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[7px] text-neutral-500 pl-1">+{dayEvents.length - 3} mais</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right - Upcoming Events Panel */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#222] bg-[#0a0a0a]">
            <div className="p-4 md:p-6">
              <h4 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-4">Próximos Eventos</h4>
              <div className="space-y-2">
                {upcomingEvents.map((event, idx) => {
                  const eventDate = event.date ? new Date(event.date + 'T12:00:00') : null;
                  const daysUntil = eventDate ? Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  return (
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
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors group ${idx > 0 ? 'border-t border-[#222]' : ''}`}
                    >
                      <div className="flex flex-col items-center min-w-[36px]">
                        <span className="text-[18px] font-black text-white leading-none">
                          {eventDate ? eventDate.getDate() : '—'}
                        </span>
                        <span className="text-[8px] text-neutral-500 uppercase font-bold">
                          {eventDate ? eventDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate group-hover:underline">{event.title || 'Sem título'}</p>
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${event.status ? statusBg[event.status] : 'bg-[#333]'} ${event.status === 'confirmado' ? 'text-black' : 'text-white'}`}>
                            {event.status ? statusLabel[event.status] : '—'}
                          </span>
                          {event.eventType && <span>{event.eventType}</span>}
                          {event.time && <><span>•</span><span>{event.time}</span></>}
                        </div>
                        {daysUntil !== null && (
                          <p className="text-[8px] text-neutral-600 mt-1">
                            {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {upcomingEvents.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar size={24} className="mx-auto text-neutral-600 mb-2" />
                    <p className="text-[10px] text-neutral-500 italic">Nenhum evento futuro</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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

      {/* Create Event/Client Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">Novo Evento</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 hover:bg-[#222] rounded-md transition-colors">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            {/* Mode toggle */}
            <div className="flex border-b border-[#222]">
              <button
                onClick={() => setCreateMode('novo_cliente')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${createMode === 'novo_cliente' ? 'text-[#B5FF03] border-b-2 border-[#B5FF03]' : 'text-neutral-500 hover:text-white'}`}
              >
                Novo Cliente
              </button>
              <button
                onClick={() => setCreateMode('novo_evento')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${createMode === 'novo_evento' ? 'text-[#B5FF03] border-b-2 border-[#B5FF03]' : 'text-neutral-500 hover:text-white'}`}
              >
                Novo Evento
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-4">
              {createMode === 'novo_cliente' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <User size={12} /> Nome
                    </label>
                    <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <Phone size={12} /> WhatsApp
                      </label>
                      <input type="text" value={formData.whatsapp} onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <Mail size={12} /> E-mail
                      </label>
                      <input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <CreditCard size={12} /> CPF
                    </label>
                    <input type="text" value={formData.cpf} onChange={e => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" />
                  </div>
                </>
              ) : (
                <div ref={clientSearchRef}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <User size={12} /> Selecione o Cliente
                  </label>
                  <div className="relative">
                    <div className="flex items-center bg-[#111] border border-[#333] rounded-lg overflow-hidden focus-within:border-[#B5FF03] transition-colors">
                      <Search size={14} className="text-neutral-500 ml-3 shrink-0" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); setSelectedClientId(''); }}
                        onFocus={() => setClientSearchOpen(true)}
                        placeholder="Digite para buscar..."
                        className="w-full bg-transparent border-none px-2 py-2 text-sm text-white placeholder-neutral-600 outline-none"
                        autoComplete="off"
                      />
                    </div>
                    {clientSearchOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg max-h-48 overflow-y-auto z-50 shadow-xl">
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-neutral-500 italic">Nenhum cliente encontrado</div>
                        ) : (
                          filteredClients.map(lead => (
                            <button
                              type="button"
                              key={lead.id}
                              onClick={() => { setSelectedClientId(lead.id); setClientSearch(`${lead.name} — ${lead.whatsapp}`); setClientSearchOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-[#333] transition-colors flex items-center gap-2 ${selectedClientId === lead.id ? 'bg-[#2a2a2a] border-l-2 border-[#B5FF03]' : ''}`}
                            >
                              <User size={12} className="text-neutral-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="block truncate">{lead.name}</span>
                                <span className="block text-[10px] text-neutral-500 truncate">{lead.whatsapp}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {selectedClientId && (
                    <p className="text-[10px] text-[#B5FF03] mt-1">Cliente selecionado</p>
                  )}
                </div>
              )}
              {/* Event fields — common to both modes */}
              <div className="border-t border-[#222] pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-3">Dados do Evento</p>
                <div className="space-y-3">
                  <div ref={eventTypeRef}>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <CalendarDays size={12} /> Tipo de Evento
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setEventTypeOpen(prev => !prev)}
                        className={`w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 transition-colors ${formData.eventType ? 'text-white' : 'text-neutral-500'} focus:border-[#B5FF03] outline-none`}
                      >
                        <span>{formData.eventType ? EVENT_TYPES.find(t => t.value === formData.eventType)?.label || formData.eventType : 'Selecionar...'}</span>
                        <ChevronDown size={14} className={`text-neutral-500 transition-transform ${eventTypeOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {eventTypeOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden z-50 shadow-xl">
                          {EVENT_TYPES.map(t => (
                            <button
                              type="button"
                              key={t.value}
                              onClick={() => { setFormData(prev => ({ ...prev, eventType: t.value })); setEventTypeOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${formData.eventType === t.value ? 'bg-[#2a2a2a] text-[#B5FF03] font-bold' : 'text-white hover:bg-[#333]'}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <CalendarDays size={12} /> Data
                      </label>
                      <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <Clock size={12} /> Horário
                      </label>
                      <input type="time" value={formData.time} onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit"
                className="w-full py-3 bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors">
                {createMode === 'novo_cliente' ? 'Cadastrar Cliente e Agendar' : 'Agendar Evento'}
              </button>
            </form>
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