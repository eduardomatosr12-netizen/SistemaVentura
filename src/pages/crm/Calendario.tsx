import { useState, useEffect, useRef, useMemo } from 'react';
import { useCRM } from '../../contexts/CRMContext';
import type { CalendarEvent } from '../../contexts/CRMContext';
import { generateUUID } from '../../lib/uuid';
import { X, ExternalLink, Clock, User, Users, MessageSquare, Plus, Trash2, Calendar as CalendarIcon, Link as LinkIcon, FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const CRMCalendario = () => {
  const { events, addEvent, updateEvent, deleteEvent, Orçamentos } = useCRM();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  
  // Form State
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    eventType: 'Reunião',
    date: '',
    client: '',
    clientId: '',
    city: '',
    decorator: '',
    description: '',
    equipe: ''
  });

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return '--/--';
    try {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) {
      return '--/--';
    }
  };

  const getEventsForDay = (day: number) => {
    return safeEvents.filter(e => {
      if (!e?.date) return false;
      const d = new Date(e.date + 'T12:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const handleOpenCreate = () => {
    const defaultDate = new Date(currentYear, currentMonth, today.getDate());
    const dateStr = defaultDate.toISOString().slice(0, 10);
    setModalMode('create');
    setFormData({
      title: '',
      eventType: 'Reunião',
      date: dateStr,
      client: '',
      clientId: '',
      city: '',
      decorator: '',
      description: '',
      equipe: ''
    });
    setClientSearch('');
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    setModalMode('edit');
    setSelectedEvent(event);
    setFormData({
      title: event.title || '',
      eventType: event.eventType || 'Reunião',
      date: event.date || '',
      client: event.client || '',
      clientId: event.clientId || '',
      city: event.city || '',
      decorator: event.decorator || '',
      description: event.description || '',
      equipe: event.equipe || ''
    });
    setClientSearch(event.client || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'create') {
      addEvent(formData);
    } else if (selectedEvent) {
      updateEvent(selectedEvent.id, formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (selectedEvent && window.confirm('Tem certeza que deseja excluir este evento?')) {
      deleteEvent(selectedEvent.id);
      setIsModalOpen(false);
    }
  };

  return (
     <div className="min-h-screen p-2 md:p-8 bg-[#000000]">
       <div className="mb-4 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-0">
         <div className="flex items-center gap-4">
           <div>
             <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Calendário</h1>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="lg:col-span-3 bg-[#000000] border border-[#1a1a1a] rounded-md p-6 shadow-sm overflow-hidden">
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
                const dayEvents = isCurrentMonth ? getEventsForDay(dayNum) : [];

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

                    {/* Day Events Tags */}
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <button
                          key={event?.id || generateUUID()}
                          onClick={() => handleOpenEdit(event)}
                           className="w-full text-left p-1.5 rounded-md bg-[#111] border border-[#333] hover:border-[#B5FF03] transition-all group overflow-hidden"
                         >
                            <div className="text-[9px] font-black text-[#B5FF03] leading-none mb-1">
                              {formatDate(event?.date)}
                            </div>
                            <div className="text-[9px] font-bold text-neutral-400 truncate leading-none">
                              {event?.eventType || 'Evento'}
                            </div>
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
               {safeEvents.slice(0, 5).map((event) => (
                 <div
                   key={event?.id || generateUUID()}
                   className="group cursor-pointer"
                   onClick={() => handleOpenEdit(event)}
                 >
                   <div className="flex items-start gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#B5FF03] mt-2 shrink-0" />
                     <div>
                       <p className="text-[13px] font-black text-white group-hover:underline leading-tight">{event?.title || 'Sem título'}</p>
                       <div className="flex flex-wrap items-center gap-x-2 mt-1.5">
                          <span className="text-[9px] font-black bg-[#111] text-neutral-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            {event?.eventType || 'Evento'}
                          </span>
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">
                            {formatDate(event?.date)}
                          </span>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
               {safeEvents.length === 0 && (
                 <p className="text-[10px] text-neutral-500 text-center font-bold uppercase tracking-widest py-4 italic">Sem eventos</p>
               )}
             </div>
           </div>
         </div>
      </div>

       {/* Event Modal (Create/Edit) */}
       {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
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

               <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                        <MessageSquare size={12} strokeWidth={3} className="text-[#B5FF03]" />
                        TIPO DE EVENTO
                      </label>
                      <select
                        value={formData.eventType}
                        onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                      >
                        <option value="Reunião">Reunião</option>
                        <option value="Ligação">Ligação</option>
                        <option value="Treinamento">Treinamento</option>
                        <option value="Outro">Outro</option>
                      </select>
                   </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[9px] font-black text-[#B5FF03] uppercase tracking-widest">
                        <CalendarIcon size={12} strokeWidth={3} className="text-[#B5FF03]" />
                        DATA
                      </label>
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                 </div>

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
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-48 overflow-y-auto">
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
                                setFormData({ ...formData, client: o.name, clientId: o.id });
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
                      <Users size={12} strokeWidth={3} className="text-[#B5FF03]" />
                      EQUIPE
                    </label>
                    <input
                      type="text"
                      value={formData.equipe}
                      onChange={(e) => setFormData({ ...formData, equipe: e.target.value })}
                      placeholder="Liste os membros da equipe para este evento"
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs font-black text-white focus:ring-1 focus:ring-[#B5FF03] outline-none transition-all"
                    />
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
