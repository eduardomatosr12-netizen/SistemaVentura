import { useState, useEffect, useRef, useMemo } from 'react';
import { useCRM } from '../../contexts/CRMContext';
import type { CalendarEvent } from '../../contexts/CRMContext';
import { generateUUID } from '../../lib/uuid';
import { generateWhatsAppLink } from '../../lib/whatsapp';
import { subscribeInventoryChanges, getAllInventoryItems } from '../../lib/inventory';
import { X, ExternalLink, Clock, User, Users, MessageSquare, Plus, Trash2, Calendar as CalendarIcon, Link as LinkIcon, FileText, ChevronLeft, ChevronRight, Search, MapPin, Mail, Phone, CreditCard, Flag, MessageCircle, Package } from 'lucide-react';

const toBR = (iso: string): string => {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const m = iso.match(/^\d{4}-\d{2}-\d{2}/);
  if (!m) return iso;
  const [y, mo, d] = m[0].split('-');
  return `${d}/${mo}/${y}`;
};

const toISO = (br: string): string => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const maskDate = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmado', color: 'text-[#B5FF03]', bg: 'bg-[#B5FF03]/10 border-[#B5FF03]' },
  pendente: { label: 'Pendente', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10 border-[#f59e0b]' },
  cancelado: { label: 'Cancelado', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10 border-[#ef4444]' },
  realizado: { label: 'Realizado', color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10 border-[#3b82f6]' },
};

const getEventStatusColor = (status?: string): string => {
  switch (status) {
    case 'confirmado': return '#B5FF03';
    case 'pendente': return '#f59e0b';
    case 'cancelado': return '#ef4444';
    case 'realizado': return '#3b82f6';
    default: return '#6b7280';
  }
};

const getEventStatusBg = (status?: string): string => {
  switch (status) {
    case 'confirmado': return 'rgba(181,255,3,0.15)';
    case 'pendente': return 'rgba(245,158,11,0.15)';
    case 'cancelado': return 'rgba(239,68,68,0.15)';
    case 'realizado': return 'rgba(59,130,246,0.15)';
    default: return 'rgba(107,114,128,0.15)';
  }
};

type EventPhase = 'montagem' | 'evento' | 'desmontagem';

interface CalendarOccurrence {
  event: CalendarEvent;
  phase: EventPhase;
}

const PHASE_CONFIG: Record<EventPhase, { label: string; shortLabel: string; color: string; bg: string }> = {
  montagem: { label: 'Montagem', shortLabel: 'M', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  evento: { label: 'Evento', shortLabel: 'E', color: '#B5FF03', bg: 'rgba(181,255,3,0.15)' },
  desmontagem: { label: 'Desmontagem', shortLabel: 'D', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const getPhaseColor = (occ: CalendarOccurrence): string => {
  if (occ.phase === 'evento') return getEventStatusColor(occ.event.status);
  return PHASE_CONFIG[occ.phase].color;
};

const getPhaseBg = (occ: CalendarOccurrence): string => {
  if (occ.phase === 'evento') return getEventStatusBg(occ.event.status);
  return PHASE_CONFIG[occ.phase].bg;
};

const CRMCalendario = () => {
  const { events, addEvent, updateEvent, deleteEvent, Orçamentos } = useCRM();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [viewEvent, setViewEvent] = useState<CalendarEvent | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Form State
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    eventType: '',
    date: '',
    time: '',
    local: '',
    client: '',
    clientId: '',
    clientEmail: '',
    clientPhone: '',
    clientCpf: '',
    status: 'pendente',
    city: '',
    decorator: '',
    description: '',
    equipe: '',
    dataMontagem: '',
    dataDesmontagem: '',
  });

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const [equipeMembers, setEquipeMembers] = useState<string[]>([]);
  const [equipeSearch, setEquipeSearch] = useState('');
  const [showEquipeDropdown, setShowEquipeDropdown] = useState(false);
  const equipeDropdownRef = useRef<HTMLDivElement>(null);

  const [dateDisplay, setDateDisplay] = useState('');

  const [invStockItems, setInvStockItems] = useState<{ name: string; qty: number; category: string; valorUnit: number }[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invSearchOpen, setInvSearchOpen] = useState(false);
  const [eventItems, setEventItems] = useState<{ id: string; item: string; qtdAtual: number; valorUnit: number }[]>([]);

  const filteredInvItems = useMemo(() => {
    if (!invSearch.trim()) return invStockItems.slice(0, 40);
    const q = invSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return invStockItems.filter(i =>
      i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    ).slice(0, 40);
  }, [invStockItems, invSearch]);

  const closedOrçamentos = useMemo(() => {
    return Orçamentos.filter(o => o.stage === 'Contrato Fechado');
  }, [Orçamentos]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return closedOrçamentos;
    const q = clientSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return closedOrçamentos.filter(o =>
      o.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [closedOrçamentos, clientSearch]);

  const parseDate = (val: string): Date | null => {
    if (!val) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/');
      return new Date(+y, +m - 1, +d);
    }
    const d = new Date(val + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  };

  const buildItemsDescription = (lead: typeof Orçamentos[number]): string => {
    const items = lead.items;
    if (!items || items.length === 0) return '';
    const lines = items.map(i => `- ${i.qtdAtual}x ${i.item}`);
    return `Itens do Orçamento Fechado:\n${lines.join('\n')}`;
  };

  const handleAdicionarItemEstoque = (prod: { name: string; qty: number; valorUnit: number }) => {
    const newItem = { id: generateUUID(), item: prod.name, qtdAtual: 1, valorUnit: prod.valorUnit || 0 };
    setEventItems(prev => [...prev, newItem]);
    setInvSearch('');
    setInvSearchOpen(false);
  };

  const handleRemoverItemEstoque = (id: string) => {
    setEventItems(prev => prev.filter(i => i.id !== id));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
      if (equipeDropdownRef.current && !equipeDropdownRef.current.contains(e.target as Node)) {
        setShowEquipeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setInvStockItems(getAllInventoryItems());
    const unsub = subscribeInventoryChanges(() => {
      setInvStockItems(getAllInventoryItems());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!formData.clientId) return;
    const lead = closedOrçamentos.find(o => o.id === formData.clientId);
    if (lead) {
      const itemsDesc = buildItemsDescription(lead);
      const updates: Partial<typeof formData> = {};
      if (itemsDesc) updates.description = itemsDesc;
      if (lead.whatsapp) updates.clientPhone = lead.whatsapp;
      if (lead.email) updates.clientEmail = lead.email;
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [formData.clientId]);

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const safeEvents = Array.isArray(events) ? events : [];

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--/--';
    const date = parseDate(dateStr);
    if (!date) return '--/--';
    try {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '--/--';
    }
  };

  const getOccurrencesForDay = (day: number): CalendarOccurrence[] => {
    const result: CalendarOccurrence[] = [];
    for (const e of safeEvents) {
      if (!e) continue;
      if (e.date) {
        const d = parseDate(e.date);
        if (d && d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          result.push({ event: e, phase: 'evento' });
        }
      }
      if (e.dataMontagem) {
        const d = parseDate(e.dataMontagem);
        if (d && d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          result.push({ event: e, phase: 'montagem' });
        }
      }
      if (e.dataDesmontagem) {
        const d = parseDate(e.dataDesmontagem);
        if (d && d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          result.push({ event: e, phase: 'desmontagem' });
        }
      }
    }
    const phaseOrder: Record<EventPhase, number> = { montagem: 0, evento: 1, desmontagem: 2 };
    result.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);
    return result;
  };

  const handleOpenCreate = () => {
    const d = new Date(currentYear, currentMonth, today.getDate());
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const iso = `${yyyy}-${mm}-${dd}`;
    setModalMode('create');
    setFormData({
      title: '',
      eventType: '',
      date: iso,
      time: '',
      local: '',
      client: '',
      clientId: '',
      clientEmail: '',
      clientPhone: '',
      clientCpf: '',
      status: 'pendente',
      city: '',
      decorator: '',
      description: '',
      equipe: '',
      dataMontagem: '',
      dataDesmontagem: '',
    });
    setDateDisplay(`${dd}/${mm}/${yyyy}`);
    setClientSearch('');
    setSelectedEvent(null);
    setEventItems([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    setModalMode('edit');
    setSelectedEvent(event);
    const brDate = toBR(event.date || '');
    setFormData({
      title: event.title || '',
      eventType: event.eventType || '',
      date: toISO(brDate) || event.date || '',
      time: event.time || '',
      local: event.local || '',
      client: event.client || '',
      clientId: event.clientId || '',
      clientEmail: event.clientEmail || '',
      clientPhone: event.clientPhone || '',
      clientCpf: event.clientCpf || '',
      status: event.status || 'pendente',
      city: event.city || '',
      decorator: event.decorator || '',
      description: event.description || '',
      equipe: event.equipe || '',
      dataMontagem: event.dataMontagem || '',
      dataDesmontagem: event.dataDesmontagem || '',
    });
    setDateDisplay(brDate);
    setClientSearch(event.client || '');
    setIsModalOpen(true);
  };

  const handleOpenView = (event: CalendarEvent) => {
    setViewEvent(event);
    setShowViewModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const itemsText = eventItems.length > 0
      ? `\n\nItens do Evento:\n${eventItems.map(i => `- ${i.qtdAtual}x ${i.item} (R$ ${(i.qtdAtual * i.valorUnit).toFixed(2)})`).join('\n')}`
      : '';
    const payload = {
      ...formData,
      description: formData.description + itemsText,
    };
    if (modalMode === 'create') {
      addEvent(payload);
    } else if (selectedEvent) {
      updateEvent(selectedEvent.id, payload);
    }
    setIsModalOpen(false);
    setEventItems([]);
  };

  const handleDelete = () => {
    if (selectedEvent && window.confirm('Tem certeza que deseja excluir este evento?')) {
      deleteEvent(selectedEvent.id);
      setIsModalOpen(false);
    }
  };

  const formatFullDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = parseDate(dateStr);
    if (!date) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getOccurrenceDate = (occ: CalendarOccurrence): Date | null => {
    switch (occ.phase) {
      case 'evento': return parseDate(occ.event.date);
      case 'montagem': return parseDate(occ.event.dataMontagem);
      case 'desmontagem': return parseDate(occ.event.dataDesmontagem);
    }
  };

  const upcomingOccurrences = useMemo(() => {
    const all: CalendarOccurrence[] = [];
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (const e of safeEvents) {
      if (!e) continue;
      if (e.date) {
        const d = parseDate(e.date);
        if (d && d >= todayStart) all.push({ event: e, phase: 'evento' });
      }
      if (e.dataMontagem) {
        const d = parseDate(e.dataMontagem);
        if (d && d >= todayStart) all.push({ event: e, phase: 'montagem' });
      }
      if (e.dataDesmontagem) {
        const d = parseDate(e.dataDesmontagem);
        if (d && d >= todayStart) all.push({ event: e, phase: 'desmontagem' });
      }
    }
    all.sort((a, b) => {
      const da = getOccurrenceDate(a);
      const db = getOccurrenceDate(b);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    });
    return all.slice(0, 5);
  }, [safeEvents]);

  return (
    <div className="min-h-screen p-2 md:p-8 bg-[#000000]">
      <div className="mb-4 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Calendário de Eventos</h1>
            <p className="text-neutral-400 text-xs md:text-sm">Visualize e acompanhe seus compromissos agendados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-[#111] rounded-md transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <span className="text-sm font-black text-white min-w-[100px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-[#111] rounded-md transition-colors"
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        </div>
        <button
          onClick={handleOpenCreate}
          className="w-full md:w-auto bg-[#B5FF03] text-black px-4 md:px-6 py-2 md:py-3 rounded-md font-black text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 hover:bg-[#a1e600] transition-all active:scale-[0.98] shadow-sm"
        >
          <Plus size={14} className="md:w-4 md:h-4" strokeWidth={3} />
          <span className="hidden sm:inline">CRIAR</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Status Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md">
        <span className="text-[9px] font-black text-white uppercase tracking-widest mr-2">Legenda:</span>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getEventStatusColor(key) }} />
            <span className="text-[10px] text-neutral-400 font-medium">{config.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="lg:col-span-3 bg-[#000000] border border-[#1a1a1a] rounded-md p-6 shadow-sm overflow-x-auto">
          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {days.map((day) => (
              <div key={day} className="text-center text-[10px] text-white font-black uppercase tracking-widest py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Body */}
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const firstDay = new Date(currentYear, currentMonth, 1).getDay();
              const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
              const startOffset = firstDay === 0 ? 6 : firstDay - 1;
              const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

              return Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - startOffset + 1;
                const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
                const isToday = isCurrentMonth && dayNum === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                const dayOccurrences = isCurrentMonth ? getOccurrencesForDay(dayNum) : [];

                return (
                  <div
                    key={idx}
                    className={`min-h-[120px] p-2 border border-[#1a1a1a] rounded-md flex flex-col gap-1 transition-all ${
                      isCurrentMonth ? 'bg-[#000000] hover:border-[#333]' : 'bg-[#000000]/50'
                    } ${isToday ? 'ring-2 ring-[#B5FF03] ring-inset' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-black ${
                        isToday ? 'bg-[#B5FF03] text-black w-5 h-5 flex items-center justify-center rounded-full' :
                        isCurrentMonth ? 'text-white' : 'text-neutral-600'
                      }`}>
                        {isCurrentMonth && dayNum}
                      </span>
                    </div>

                    {/* Day Occurrences Tags */}
                    <div className="space-y-1">
                      {dayOccurrences.map(occ => (
                        <button
                          key={`${occ.event.id}-${occ.phase}`}
                          onClick={() => handleOpenView(occ.event)}
                          className="w-full text-left p-1.5 rounded-md transition-all group overflow-hidden"
                          style={{
                            backgroundColor: getPhaseBg(occ),
                            borderLeft: `3px solid ${getPhaseColor(occ)}`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className="text-[7px] font-black px-1 py-0.5 rounded-sm uppercase leading-none"
                              style={{
                                backgroundColor: getPhaseColor(occ),
                                color: '#000',
                              }}
                            >
                              {PHASE_CONFIG[occ.phase].shortLabel}
                            </span>
                            <span
                              className="text-[8px] font-bold leading-none"
                              style={{ color: getPhaseColor(occ) }}
                            >
                              {occ.phase === 'evento'
                                ? (occ.event.eventType || 'Evento')
                                : PHASE_CONFIG[occ.phase].label}
                            </span>
                          </div>
                          <div className="text-[8px] font-bold text-neutral-400 truncate leading-none">
                            {occ.event.time || '--:--'}
                          </div>
                          {occ.event.title && (
                            <div className="text-[8px] font-medium text-white truncate leading-none mt-0.5">
                              {occ.event.title}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Sidebar: Upcoming Events */}
        <div className="space-y-6">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-6 border-b border-[#1a1a1a] pb-4 flex items-center gap-2">
              <Clock size={12} className="text-[#B5FF03]" />
              PRÓXIMOS EVENTOS
            </h3>
            <div className="space-y-5">
              {upcomingOccurrences.map((occ) => (
                <button
                  type="button"
                  key={`${occ.event.id}-${occ.phase}`}
                  className="group w-full text-left"
                  onClick={() => handleOpenView(occ.event)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                      style={{ backgroundColor: getPhaseColor(occ) }} />
                    <div>
                      <p className="text-[13px] font-black text-white group-hover:underline leading-tight">{occ.event?.title || 'Sem título'}</p>
                      <div className="flex flex-wrap items-center gap-x-2 mt-1.5">
                        <span className="text-[9px] font-black bg-[#111] text-neutral-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          {occ.event?.eventType || 'Evento'}
                        </span>
                        <span
                          className="text-[8px] font-black px-1 py-0.5 rounded-sm uppercase leading-none"
                          style={{
                            backgroundColor: getPhaseColor(occ),
                            color: '#000',
                          }}
                        >
                          {PHASE_CONFIG[occ.phase].shortLabel}
                        </span>
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">
                          {(() => {
                            const d = getOccurrenceDate(occ);
                            return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '--/--';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {safeEvents.length === 0 && (
                <p className="text-[10px] text-neutral-500 text-center font-bold uppercase tracking-widest py-4 italic">Sem eventos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event View Modal */}
      {showViewModal && viewEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-8 py-7 border-b border-[#333] flex justify-between items-start bg-[#111]">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[2px] mb-2 block"
                  style={{ color: getEventStatusColor(viewEvent.status) }}>
                  {STATUS_CONFIG[viewEvent.status || 'pendente']?.label || 'Pendente'}
                </span>
                <h2 className="text-2xl font-black text-white tracking-tighter leading-tight">{viewEvent.title || 'Evento'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-[#222] rounded-full transition-colors text-neutral-400 hover:text-white mt-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {/* Tipo e Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-1">TIPO DE EVENTO</label>
                  <p className="text-sm font-bold text-white">{viewEvent.eventType || '—'}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-1">HORÁRIO</label>
                  <p className="text-sm font-bold text-white">{viewEvent.time || '—'}</p>
                </div>
              </div>

              {/* Cliente Info */}
              {viewEvent.client && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-4 space-y-2">
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-2">INFORMAÇÕES DO CLIENTE</label>
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-neutral-500 shrink-0" />
                    <span className="text-sm text-white font-medium">{viewEvent.client}</span>
                  </div>
                  {viewEvent.clientPhone && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-neutral-500 shrink-0" />
                      <span className="text-sm text-white font-medium">{viewEvent.clientPhone}</span>
                      <button
                        type="button"
                        onClick={() => window.open(generateWhatsAppLink(viewEvent.clientPhone!), '_blank')}
                        className="text-[#25D366] hover:text-[#B5FF03] transition-colors ml-auto"
                        title="Enviar mensagem via WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                    </div>
                  )}
                  {viewEvent.clientEmail && (
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-neutral-500 shrink-0" />
                      <span className="text-sm text-white font-medium">{viewEvent.clientEmail}</span>
                    </div>
                  )}
                  {viewEvent.clientCpf && (
                    <div className="flex items-center gap-2">
                      <CreditCard size={12} className="text-neutral-500 shrink-0" />
                      <span className="text-sm text-white font-medium">CPF: {viewEvent.clientCpf}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Três Marcos Temporais */}
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-4">
                <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-3">MARCOS DO EVENTO</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#B5FF03]/20 flex items-center justify-center shrink-0">
                      <CalendarIcon size={14} className="text-[#B5FF03]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Data do Evento</p>
                      <p className="text-sm font-black text-white">{formatFullDate(viewEvent.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f59e0b]/20 flex items-center justify-center shrink-0">
                      <Flag size={14} className="text-[#f59e0b]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Montagem</p>
                      <p className="text-sm font-black text-white">{viewEvent.dataMontagem ? formatFullDate(viewEvent.dataMontagem) : '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ef4444]/20 flex items-center justify-center shrink-0">
                      <Flag size={14} className="text-[#ef4444]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Desmontagem</p>
                      <p className="text-sm font-black text-white">{viewEvent.dataDesmontagem ? formatFullDate(viewEvent.dataDesmontagem) : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Local */}
              {viewEvent.local && (
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-neutral-500 shrink-0" />
                  <span className="text-sm text-white">{viewEvent.local}</span>
                </div>
              )}

              {/* Descrição */}
              {viewEvent.description && (
                <div>
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-1">DESCRIÇÃO</label>
                  <p className="text-xs text-neutral-300 whitespace-pre-wrap">{viewEvent.description}</p>
                </div>
              )}

              {/* Equipe */}
              {viewEvent.equipe && (
                <div>
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block mb-1">EQUIPE</label>
                  <div className="flex flex-wrap gap-1">
                    {viewEvent.equipe.split(',').map(name => (
                      <span key={name.trim()} className="px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded-md text-[10px] text-white font-bold">
                        {name.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-[#0a0a0a] flex justify-between items-center border-t border-[#333]">
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenEdit(viewEvent);
                }}
                className="px-6 py-2.5 bg-[#B5FF03] text-black rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-[#a1e600] transition-all"
              >
                EDITAR
              </button>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300 max-h-[95vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-8 py-7 border-b border-[#333] flex justify-between items-start bg-[#111]">
                <div>
                  <span className="text-[9px] font-black text-[#B5FF03] uppercase tracking-[2px] mb-2 block">
                    {modalMode === 'create' ? 'NOVO EVENTO' : 'EDITAR EVENTO'}
                  </span>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Título do Evento"
                    className="text-2xl font-black text-white tracking-tighter leading-tight w-full bg-transparent border-none p-0 focus:ring-0 placeholder:text-neutral-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-[#222] rounded-full transition-colors text-neutral-400 hover:text-white mt-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                {/* Status */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <Flag size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    STATUS
                  </label>
                  <select
                    value={formData.status || 'pendente'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CalendarEvent['status'] })}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="realizado">Realizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                      <MessageSquare size={12} strokeWidth={3} className="text-[#B5FF03]" />
                      TIPO DE EVENTO
                    </label>
                    {(() => {
                      const predefined = ['Aniver', 'Casam', 'Corporativo', 'Privado', 'Outros'];
                      const isCustom = formData.eventType && !predefined.includes(formData.eventType);
                      return (
                        <>
                          <select
                            value={isCustom ? 'Outros' : (formData.eventType || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Outros') {
                                setFormData({ ...formData, eventType: '' });
                              } else {
                                setFormData({ ...formData, eventType: val });
                              }
                            }}
                            className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                          >
                            <option value="">Selecione...</option>
                            <option value="Aniver">Aniver (Aniversário)</option>
                            <option value="Casam">Casam (Casamento)</option>
                            <option value="Corporativo">Corporativo</option>
                            <option value="Privado">Privado</option>
                            <option value="Outros">Outros</option>
                          </select>
                          {(formData.eventType === '' || isCustom) && (
                            <input
                              type="text"
                              value={isCustom ? formData.eventType : ''}
                              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                              className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 mt-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                              placeholder="Especifique o tipo de evento"
                              required
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                        <CalendarIcon size={12} strokeWidth={3} className="text-[#B5FF03]" />
                        DATA
                      </label>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        value={dateDisplay}
                        onChange={(e) => {
                          const masked = maskDate(e.target.value);
                          setDateDisplay(masked);
                          const iso = toISO(masked);
                          if (iso) setFormData(prev => ({ ...prev, date: iso }));
                        }}
                        placeholder="DD/MM/AAAA"
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2.5 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all tracking-wider"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                        <Clock size={12} strokeWidth={3} className="text-[#B5FF03]" />
                        HORÁRIO
                      </label>
                      <input
                        type="time"
                        value={formData.time || ''}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                {/* Três Marcos Temporais */}
                <div className="border border-[#1a1a1a] rounded-md p-4 space-y-3">
                  <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block">MARCOS DO EVENTO</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Data do Evento</label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-2 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Montagem</label>
                      <input
                        type="date"
                        value={formData.dataMontagem || ''}
                        onChange={(e) => setFormData({ ...formData, dataMontagem: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-2 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Desmontagem</label>
                      <input
                        type="date"
                        value={formData.dataDesmontagem || ''}
                        onChange={(e) => setFormData({ ...formData, dataDesmontagem: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-2 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                {/* Cliente */}
                <div className="space-y-2 relative" ref={clientDropdownRef}>
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <User size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    CLIENTE
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setFormData({ ...formData, client: e.target.value, clientId: '' });
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Pesquise por clientes com orçamentos fechados..."
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-md pl-9 pr-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                    />
                  </div>
                  {showClientDropdown && (
                    <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-48 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-neutral-500 text-center">
                          Nenhum orçamento fechado encontrado
                        </p>
                      ) : (
                        filteredClients.map(o => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                                                setClientSearch(o.name);
                              const itemsDesc = buildItemsDescription(o);
                              const itemsFromLead = (o.items || []).map(i => ({
                                id: generateUUID(),
                                item: i.item,
                                qtdAtual: i.qtdAtual,
                                valorUnit: i.valorUnit || 0,
                              }));
                              setEventItems(itemsFromLead);
                              setFormData(prev => ({
                                ...prev,
                                client: o.name,
                                clientId: o.id,
                                description: itemsDesc || prev.description,
                                local: o.address || prev.local || '',
                                clientPhone: o.whatsapp || prev.clientPhone || '',
                                clientEmail: o.email || prev.clientEmail || '',
                              }));
                              setShowClientDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333] transition-colors border-b border-[#222] last:border-b-0"
                          >
                            {o.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Dados do Cliente */}
                {formData.client && (
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-4 space-y-3">
                    <label className="text-[9px] font-black text-[#B5FF03] uppercase tracking-widest block">DADOS DO CLIENTE</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">TELEFONE</label>
                        <input
                          type="text"
                          value={formData.clientPhone || ''}
                          onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">E-MAIL</label>
                        <input
                          type="email"
                          value={formData.clientEmail || ''}
                          onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                          placeholder="cliente@email.com"
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">CPF</label>
                        <input
                          type="text"
                          value={formData.clientCpf || ''}
                          onChange={(e) => setFormData({ ...formData, clientCpf: e.target.value })}
                          placeholder="000.000.000-00"
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <User size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    DECORADOR
                  </label>
                  <input
                    type="text"
                    value={formData.decorator}
                    onChange={(e) => setFormData({ ...formData, decorator: e.target.value })}
                    placeholder="Nome do decorador"
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <MapPin size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    LOCAL DO EVENTO
                  </label>
                  <input
                    type="text"
                    value={formData.local || ''}
                    onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                    placeholder="Endereço do evento"
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 relative" ref={equipeDropdownRef}>
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <Users size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    EQUIPE
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                    {(formData.equipe ? formData.equipe.split(',').map(s => s.trim()).filter(Boolean) : []).map(name => (
                      <span key={name} className="inline-flex items-center gap-1 bg-[#1a1a1a] border border-[#B5FF03] rounded-md px-2 py-1 text-[10px] font-bold text-white">
                        {name}
                        <button
                          type="button"
                          onClick={() => {
                            const current = formData.equipe.split(',').map(s => s.trim()).filter(Boolean);
                            const next = current.filter(n => n !== name);
                            setFormData({ ...formData, equipe: next.join(', ') });
                          }}
                          className="text-neutral-500 hover:text-red-400 transition-colors"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={equipeSearch}
                    onChange={(e) => { setEquipeSearch(e.target.value); setShowEquipeDropdown(true); }}
                    onFocus={() => setShowEquipeDropdown(true)}
                    placeholder="Selecione os membros da equipe..."
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                  />
                  {showEquipeDropdown && (
                    <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-48 overflow-y-auto">
                      {(() => {
                        const selected = formData.equipe ? formData.equipe.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const q = equipeSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const available = equipeMembers.filter(
                          n => !selected.includes(n) && n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
                        );
                        return available.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-neutral-500 text-center">Nenhum membro encontrado</p>
                        ) : (
                          available.map(name => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                const current = formData.equipe.split(',').map(s => s.trim()).filter(Boolean);
                                setFormData({ ...formData, equipe: [...current, name].join(', ') });
                                setEquipeSearch('');
                                setShowEquipeDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333] transition-colors border-b border-[#222] last:border-b-0"
                            >
                              {name}
                            </button>
                          ))
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Itens do Estoque */}
                <div className="border border-[#1a1a1a] rounded-md p-4 space-y-3">
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <Package size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    ITENS DO ESTOQUE
                  </label>
                  {eventItems.length > 0 && (
                    <div className="space-y-1.5">
                      {eventItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 overflow-hidden">
                          <span className="text-[10px] font-bold text-white flex-1 truncate">{item.qtdAtual}x {item.item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoverItemEstoque(item.id)}
                            className="text-neutral-500 hover:text-red-400 transition-colors"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invSearch}
                        onChange={(e) => { setInvSearch(e.target.value); setInvSearchOpen(true); }}
                        onFocus={() => setInvSearchOpen(true)}
                        placeholder="Buscar item no estoque..."
                        className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                      />
                    </div>
                    {invSearchOpen && (
                      <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-40 overflow-y-auto">
                        {filteredInvItems.length > 0 ? filteredInvItems.map(prod => (
                          <button
                            key={prod.name}
                            type="button"
                            onClick={() => handleAdicionarItemEstoque(prod)}
                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333] transition-colors border-b border-[#222] last:border-b-0 flex items-center gap-2"
                          >
                            <span className="font-bold flex-1 truncate">{prod.name}</span>
                            <span className="text-neutral-400 shrink-0">disp: {prod.qty}</span>
                            <span className="text-[#B5FF03] font-bold">R$ {prod.valorUnit?.toFixed(2) || '0,00'}</span>
                          </button>
                        )) : (
                          <p className="px-3 py-3 text-xs text-neutral-500 text-center">Nenhum item encontrado</p>
                        )}
                      </div>
                    )}
                    {!invSearchOpen && eventItems.length === 0 && (
                      <p className="text-[10px] text-neutral-500 italic mt-1">
                        Selecione um cliente com orçamento fechado ou busque itens manualmente
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                    <FileText size={12} strokeWidth={3} className="text-[#B5FF03]" />
                    DESCRIÇÃO
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Adicione observações importantes..."
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="px-8 py-5 bg-[#0a0a0a] flex justify-between items-center border-t border-[#333]">
                <div className="flex items-center gap-2">
                  {modalMode === 'edit' && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-900/30 rounded-md transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#B5FF03] text-black px-8 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-[#a1e600] transition-all active:scale-[0.98] shadow-sm"
                  >
                    {modalMode === 'create' ? 'SALVAR EVENTO' : 'ATUALIZAR'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMCalendario;