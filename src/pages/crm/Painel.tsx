import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Calendar, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, LayoutDashboard, X, ChevronLeft, ChevronRight, ChevronDown, Search, User, Phone, Mail, CreditCard, CalendarDays, Clock, Plus, Trash2, MapPin, Pencil, FileText, MessageCircle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useCRM } from '../../contexts/CRMContext';
import type { CalendarEvent, Lead, OrcamentoItem } from '../../types/crm';
import { parseMonetaryValue, formatCurrency, generatePDF } from '../../lib/crmHelpers';
import { eventTypeLabel } from '../../lib/eventTypeLabel';
import { useActivityLogs } from '../../contexts/ActivityContext';
import { generateUUID } from '../../lib/uuid';
import { subscribeEventStock, addEventStockItem, EVENT_STOCK_CATEGORIES, EVENT_STOCK_UNITS, type EventStockItem } from '../../services/eventStockService';
import { addTransaction } from '../../services/financeService';
import { generateWhatsAppLink } from '../../lib/whatsapp';
import DespesasDoEvento from '../../components/DespesasDoEvento';
import EstoqueDeEventos from '../../components/EstoqueDeEventos';

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
  { value: 'Aniver', label: 'Aniversário' },
  { value: 'Casam', label: 'Casamento' },
  { value: 'Corporativo', label: 'Corporativo' },
  { value: 'Privado', label: 'Privado' },
  { value: 'Outros', label: 'Outros' },
];

const CRMDashboard = () => {
  const { events, Orçamentos, addLead, addEvent, updateEvent, updateLead, deleteEvent, deleteLead } = useCRM();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError } = useActivityLogs();
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState<'calendario' | 'eventos' | 'orcamentos' | 'estoque'>('calendario');
  const [eventPage, setEventPage] = useState(0);
  const [orcPage, setOrcPage] = useState(0);
  const ROWS_PER_PAGE = 15;
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'cliente' | 'evento' | 'despesas'>('cliente');
  const [createDate, setCreateDate] = useState('');
  const [formData, setFormData] = useState({
    name: '', whatsapp: '', email: '', cpf: '',
    eventType: '', date: '', time: '', city: '', observacao: '',
    dataMontagem: '', dataDesmontagem: '', status: '', outroEventoType: '',
    orcamentoItems: [] as OrcamentoItem[], desconto: 0,
  });
  const [selectedClientId, setSelectedClientId] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const handleRemoveItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      orcamentoItems: prev.orcamentoItems.filter(i => i.id !== id),
    }));
    setExpandedItems(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleItemChange = (id: string, field: keyof OrcamentoItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      orcamentoItems: prev.orcamentoItems.map(i => {
        if (i.id !== id) return i;
        return { ...i, [field]: field === 'item' ? value : Number(value) || 0 };
      }),
    }));
  };

  // Custom dropdown state
  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const eventTypeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Itens do orçamento (Estoque de Eventos — lista limpa para o cliente)
  const [orcamentoItems, setOrcamentoItems] = useState<EventStockItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [orcSearch, setOrcSearch] = useState('');
  const [orcSearchOpen, setOrcSearchOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [inlineItemSearch, setInlineItemSearch] = useState('');
  const [showCreateItemForm, setShowCreateItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: EVENT_STOCK_CATEGORIES[0],
    quantity: '',
    unit: 'unidade',
    valorReferencia: '',
    observacao: '',
  });
  const orcSearchRef = useRef<HTMLDivElement>(null);

  const clientList = useMemo(() => {
    const seen = new Set<string>();
    return Orçamentos.flatMap(o => {
      const key = o.name?.trim().toLowerCase() || o.id;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: o.id,
        nome: o.name,
        whatsapp: o.whatsapp,
        cidade: o.address,
      }];
    });
  }, [Orçamentos]);

  const filteredOrcItems = useMemo(() => {
    if (!orcSearch.trim()) return orcamentoItems.slice(0, 40);
    const q = orcSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return orcamentoItems.filter(i =>
      i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    ).slice(0, 40);
  }, [orcamentoItems, orcSearch]);

  const handleAdicionarItem = (prod: EventStockItem) => {
    const newItem: OrcamentoItem = {
      id: generateUUID(),
      item: `${prod.name} — 1 ${prod.unit}`,
      qtdAtual: 1,
      valorUnit: 0,
      semPreco: true,
    };
    setFormData(prev => ({
      ...prev,
      orcamentoItems: [...prev.orcamentoItems, newItem],
    }));
    setExpandedItems(prev => new Set(prev).add(newItem.id));
    setOrcSearch('');
    setOrcSearchOpen(false);
  };

  const handleCreateEventItem = async () => {
    const name = newItemForm.name.trim();
    if (!name) return;
    try {
      const quantity = Math.max(0, Number(newItemForm.quantity) || 0);
      const valorReferencia = parseFloat(String(newItemForm.valorReferencia).replace(',', '.')) || 0;
      const newId = generateUUID();
      await addEventStockItem({
        name,
        category: newItemForm.category,
        quantity,
        unit: newItemForm.unit,
        valorReferencia,
        observacao: newItemForm.observacao.trim(),
      });
      setFormData(prev => ({
        ...prev,
        orcamentoItems: [...prev.orcamentoItems, { id: newId, item: `${name} — 1 ${newItemForm.unit}`, qtdAtual: 1, valorUnit: 0, semPreco: true }],
      }));
      setExpandedItems(prev => { const next = new Set(prev); next.add(newId); return next; });
      setNewItemForm({ name: '', category: EVENT_STOCK_CATEGORIES[0], quantity: '', unit: 'unidade', valorReferencia: '', observacao: '' });
      setShowCreateItemForm(false);
      setOrcSearch('');
      setOrcSearchOpen(false);
    } catch (err) {
      console.error('[Painel] Erro ao criar item de evento:', err);
    }
  };

  const handleInlineItemSelect = (itemId: string, opt: EventStockItem) => {
    setFormData(prev => ({
      ...prev,
      orcamentoItems: prev.orcamentoItems.map(i =>
        i.id === itemId ? { ...i, item: `${opt.name} — ${i.qtdAtual} ${opt.unit}`, valorUnit: 0, semPreco: true } : i
      ),
    }));
    setEditingItemId(null);
    setInlineItemSearch('');
  };

  const subtotal = useMemo(() =>
    formData.orcamentoItems.reduce((sum, item) => sum + item.qtdAtual * item.valorUnit, 0),
  [formData.orcamentoItems]);

  const total = useMemo(() => Math.max(0, subtotal - formData.desconto), [subtotal, formData.desconto]);

  const handleExportPDF = () => {
    const leadData: Lead = {
      id: '',
      name: formData.name || 'Orçamento',
      niche: formData.eventType || '',
      whatsapp: formData.whatsapp || '',
      email: formData.email || '',
      instagram: '',
      stage: formData.status || 'Novos Orçamentos',
      firstContact: formData.date || '',
      closingDate: '',
      followUpReminder: '',
      address: formData.city || '',
      notes: formData.observacao || '',
      value: total.toString(),
      items: formData.orcamentoItems || [],
    };

    generatePDF(leadData, formData.desconto > 0 ? { type: 'fixed', value: formData.desconto } : undefined);
  };

  const handleSendWhatsApp = () => {
    if (!formData.whatsapp) return;
    const msg = 'Olá, segue o seu orçamento em PDF.';
    window.open(generateWhatsAppLink(formData.whatsapp, msg), '_blank');
  };

  const handleDeleteEvent = () => {
    if (!editingEventId) return;
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    deleteEvent(editingEventId);
    setEditingEventId(null);
    setIsCreateOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eventTypeRef.current && !eventTypeRef.current.contains(e.target as Node)) {
        setEventTypeOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientSearchOpen(false);
      }
      if (orcSearchRef.current && !orcSearchRef.current.contains(e.target as Node)) {
        setOrcSearchOpen(false);
      }
      if (editingItemId) {
        setEditingItemId(null);
        setInlineItemSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = subscribeEventStock(items => {
      setOrcamentoItems(items);
    });
    return unsub;
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientList;
    const q = clientSearch.toLowerCase();
    return clientList.filter(c =>
      c.nome.toLowerCase().includes(q) || c.whatsapp.includes(q)
    );
  }, [clientSearch, clientList]);

  const openCreateModal = (dateStr: string) => {
    setEditingEventId(null);
    setCreateDate(dateStr);
    setFormData(prev => ({ ...prev, date: dateStr, eventType: '', city: '', observacao: '', dataMontagem: '', dataDesmontagem: '', status: '', outroEventoType: '', orcamentoItems: [], desconto: 0 }));
    setSelectedClientId('');
    setClientSearch('');
    setOrcSearch('');
    setOrcSearchOpen(false);
    setShowCreateItemForm(false);
    setAbaAtiva('cliente');
    setIsCreateOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    const leadFromId = event.clientId ? Orçamentos.find(l => l.id === event.clientId) : null;
    const leadFromName = !leadFromId && event.client
      ? Orçamentos.find(l => l.name.toLowerCase().trim() === event.client!.toLowerCase().trim())
      : null;
    const lead = leadFromId || leadFromName;
    const leadId = lead?.id || event.clientId || '';
    setEditingEventId(event.id);
    setCreateDate(event.date || '');
    setFormData({
      name: event.client || '',
      whatsapp: event.clientPhone || '',
      email: event.clientEmail || '',
      cpf: event.clientCpf || '',
      eventType: event.eventType || '',
      date: event.date || '',
      time: event.time || '',
      city: event.city || '',
      observacao: event.description || '',
      dataMontagem: event.dataMontagem || '',
      dataDesmontagem: event.dataDesmontagem || '',
      status: event.status || '',
      outroEventoType: '',
      orcamentoItems: (lead?.items as OrcamentoItem[]) || [],
      desconto: event.desconto || 0,
    });
    setSelectedClientId(leadId);
    setClientSearch(event.client ? `${event.client} — ${event.clientPhone || ''}` : '');
    setOrcSearch('');
    setOrcSearchOpen(false);
    setAbaAtiva(leadId ? (event.clientId ? 'cliente_existente' : 'cliente') : 'cliente');
    setIsCreateOpen(true);
    setSelectedDayEvents(null);
    setSelectedDate(null);
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      if (editingEventId) {
        const eventFields: Partial<CalendarEvent> = {
          title: formData.eventType ? `${formData.eventType} - ${formData.name}` : formData.name,
          client: formData.name,
          clientPhone: formData.whatsapp,
          clientEmail: formData.email,
          clientCpf: formData.cpf,
          eventType: formData.eventType,
          date: formData.date,
          time: formData.time,
          city: formData.city,
          dataMontagem: formData.dataMontagem,
          dataDesmontagem: formData.dataDesmontagem,
          description: formData.observacao,
          status: (formData.status as CalendarEvent['status']) || 'pendente',
          valorTotal: total,
          desconto: formData.desconto,
          items: formData.orcamentoItems,
        };

        if (abaAtiva === 'cliente' && !selectedClientId) {
          const leadInput: Partial<Omit<Lead, 'id'>> = {
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
            address: formData.city || '',
            notes: formData.observacao || '',
          };
          if (formData.orcamentoItems.length > 0) {
            leadInput.value = total.toString();
            leadInput.items = formData.orcamentoItems;
          }
          const newLeadId = await addLead(leadInput as Omit<Lead, 'id'>);
          if (newLeadId) {
            eventFields.clientId = newLeadId;
          }
          await addTransaction({
            client: formData.name,
            description: `Evento: ${formData.eventType || 'Evento'} - ${formData.name}${formData.observacao ? ' • ' + formData.observacao : ''}`,
            amount: total,
            date: formData.date || new Date().toISOString().split('T')[0],
            status: 'Pendente',
            type: 'receita',
            source: 'evento',
          });
        }

        await updateEvent(editingEventId, eventFields);
        if (selectedClientId) {
          const leadUpdate: Partial<Lead> = {
            name: formData.name,
            whatsapp: formData.whatsapp,
            email: formData.email,
            address: formData.city || '',
            notes: formData.observacao || '',
          };
          if (formData.orcamentoItems.length > 0) {
            leadUpdate.value = total.toString();
            leadUpdate.items = formData.orcamentoItems;
          }
          await updateLead(selectedClientId, leadUpdate);
        }
        setEditingEventId(null);
      } else if (abaAtiva === 'cliente') {
        const leadInput: Partial<Omit<Lead, 'id'>> = {
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
          address: formData.city || '',
          notes: formData.observacao || '',
        };
        if (formData.orcamentoItems.length > 0) {
          leadInput.value = total.toString();
          leadInput.items = formData.orcamentoItems;
        }
        const newLeadId = await addLead(leadInput as Omit<Lead, 'id'>);
        if (newLeadId) {
          await addEvent({
            title: formData.eventType ? `${formData.eventType} - ${formData.name}` : formData.name,
            client: formData.name,
            clientId: newLeadId,
            clientPhone: formData.whatsapp,
            clientEmail: formData.email,
            clientCpf: formData.cpf,
            eventType: formData.eventType,
            date: formData.date,
            time: formData.time,
            city: formData.city,
            dataMontagem: formData.dataMontagem,
            dataDesmontagem: formData.dataDesmontagem,
            description: formData.observacao,
            status: (formData.status as CalendarEvent['status']) || 'pendente',
            valorTotal: total,
            desconto: formData.desconto,
            items: formData.orcamentoItems,
          });
        }
        await addTransaction({
          client: formData.name,
          description: `Evento: ${formData.eventType || 'Evento'} - ${formData.name}${formData.observacao ? ' • ' + formData.observacao : ''}`,
          amount: total,
          date: formData.date || new Date().toISOString().split('T')[0],
          status: 'Pendente',
          type: 'receita',
          source: 'evento',
        });
      } else {
        const client = Orçamentos.find(l => l.id === selectedClientId);
        if (!client) {
          setSubmitError('Cliente não encontrado. Selecione um cliente válido.');
          return;
        }
        await addEvent({
          title: formData.eventType ? `${formData.eventType} - ${client.name}` : client.name,
          client: client.name,
          clientId: client.id,
          clientPhone: client.whatsapp,
          clientEmail: client.email,
          clientCpf: '',
          eventType: formData.eventType,
          date: formData.date,
          time: formData.time,
          city: formData.city,
          dataMontagem: formData.dataMontagem,
          dataDesmontagem: formData.dataDesmontagem,
          description: formData.observacao,
          status: (formData.status as CalendarEvent['status']) || 'pendente',
          valorTotal: total,
          desconto: formData.desconto,
          items: formData.orcamentoItems,
        });
      }
      setIsCreateOpen(false);
    } catch (err) {
      console.error('[Painel] Erro ao salvar:', err);
      setSubmitError('Erro ao salvar. Verifique sua conexão e tente novamente.');
    }
  };

  const safeEvents = Array.isArray(events) ? events : [];
  const today = new Date();

  const eventCountsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      confirmado: 0,
      pendente: 0,
      cancelado: 0,
      realizado: 0,
    };
    safeEvents.forEach(event => {
      if (!event.date) return;
      const d = new Date(event.date + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) return;
      const status = event.status || 'pendente';
      if (status in counts) counts[status]++;
    });
    return [
      { name: 'Confirmado', value: counts.confirmado, color: '#B5FF03' },
      { name: 'Pendente', value: counts.pendente, color: '#f59e0b' },
      { name: 'Cancelado', value: counts.cancelado, color: '#ef4444' },
      { name: 'Realizado', value: counts.realizado, color: '#3b82f6' },
    ];
  }, [safeEvents, viewMonth, viewYear]);

  const displayLogs = useMemo(() => {
    return activityLogs.slice(0, 10).filter(log => log?.id && log?.acao);
  }, [activityLogs]);

  type DayOccurrence = {
    event: CalendarEvent;
    type: 'evento' | 'montagem' | 'desmontagem';
  };

  const getOccurrencesForDay = (day: number): DayOccurrence[] => {
    const result: DayOccurrence[] = [];
    const matchesDay = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr + 'T12:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    };
    for (const event of safeEvents) {
      if (matchesDay(event.date)) result.push({ event, type: 'evento' });
      if (matchesDay(event.dataMontagem)) result.push({ event, type: 'montagem' });
      if (matchesDay(event.dataDesmontagem)) result.push({ event, type: 'desmontagem' });
    }
    return result;
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
      .filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date + 'T12:00:00');
        if (isNaN(d.getTime())) return false;
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
      })
      .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
      .slice(0, 10);
  }, [safeEvents, viewMonth, viewYear]);

  const handleDayClick = (day: number) => {
    const occurrences = getOccurrencesForDay(day);
    const dateObj = new Date(viewYear, viewMonth, day);
    if (occurrences.length === 0) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      openCreateModal(dateStr);
      return;
    }
    const uniqueEvents = Array.from(new Map(occurrences.map(o => [o.event.id, o.event])).values());
    setSelectedDayEvents(uniqueEvents);
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

  const paginatedEvents = useMemo(() => {
    const start = eventPage * ROWS_PER_PAGE;
    return safeEvents.slice(start, start + ROWS_PER_PAGE);
  }, [safeEvents, eventPage]);

  const paginatedOrcamentos = useMemo(() => {
    const start = orcPage * ROWS_PER_PAGE;
    return Orçamentos.slice(start, start + ROWS_PER_PAGE);
  }, [Orçamentos, orcPage]);

  const totalEventPages = Math.max(1, Math.ceil(safeEvents.length / ROWS_PER_PAGE));
  const totalOrcPages = Math.max(1, Math.ceil(Orçamentos.length / ROWS_PER_PAGE));

  const handleTabChange = (tab: 'calendario' | 'eventos' | 'orcamentos' | 'estoque') => {
    setActiveTab(tab);
    setEventPage(0);
    setOrcPage(0);
  };

  return (
    <div className="relative min-h-screen bg-black pb-bottom-nav md:pb-0">
      {/* Header section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
          <LayoutDashboard className="text-[#B5FF03]" size={32} />
          Página Principal
        </h1>
        <p className="text-neutral-400 text-xs md:text-sm">Bem-vindo ao painel de controle da Ventura Luz e Efeitos.</p>
      </div>

      {/* 3-tab navigation */}
      <div className="flex gap-4 sm:gap-6 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        <button
          onClick={() => handleTabChange('calendario')}
          className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'calendario'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          Calendário
        </button>
        <button
          onClick={() => handleTabChange('eventos')}
          className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'eventos'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          Histórico de Eventos
        </button>
        <button
          onClick={() => handleTabChange('orcamentos')}
          className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'orcamentos'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          Histórico de Orçamentos
        </button>
        <button
          onClick={() => handleTabChange('estoque')}
          className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'estoque'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          Estoque de Eventos
        </button>
      </div>

      {/* CALENDÁRIO */}
      {activeTab === 'calendario' && (
        <>
        <div className="bg-[#111] border border-[#333] rounded-2xl shadow-sm overflow-hidden">
          {/* Top bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 md:p-6 border-b border-[#222]">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Calendário de Eventos</h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">Visualize e acompanhe seus compromissos agendados.</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1 sm:gap-2 bg-[#0a0a0a] border border-[#333] rounded-lg px-2 sm:px-3 py-1.5 flex-1 sm:flex-none justify-center">
                <button onClick={prevMonth} className="p-2 hover:bg-[#222] rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ChevronLeft size={16} className="text-neutral-400" />
                </button>
                <span className="text-xs sm:text-sm font-bold text-white min-w-[100px] sm:min-w-[140px] text-center select-none">
                  {monthNames[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth} className="p-2 hover:bg-[#222] rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ChevronRight size={16} className="text-neutral-400" />
                </button>
              </div>
              <button
                onClick={() => openCreateModal(new Date().toISOString().split('T')[0])}
                className="rounded-full px-3 sm:px-4 py-2 bg-[#B5FF03] text-black font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-[#a1e600] transition-colors min-h-[44px] shrink-0"
              >
                + CRIAR
              </button>
            </div>
          </div>

          {/* Legend bar */}
          <div className="flex items-center gap-3 sm:gap-4 px-4 md:px-6 py-3 border-b border-[#222] bg-[#0a0a0a] overflow-x-auto scrollbar-hide">
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 shrink-0">Status:</span>
            {Object.entries(statusLabel).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${statusBg[key]}`} />
                <span className="text-[10px] text-neutral-500 font-medium">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
              <span className="text-[10px] text-neutral-500 font-medium">Montagem</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#06B6D4' }} />
              <span className="text-[10px] text-neutral-500 font-medium">Desmontagem</span>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row">
            {/* Left - Calendar Grid */}
            <div className="flex-1 p-4 md:p-6">
              <div className="grid grid-cols-7 bg-[#222] rounded-lg overflow-hidden">
                {dayHeaders.map(d => (
                  <div key={d} className="bg-[#111] text-center text-[9px] font-black uppercase tracking-widest text-neutral-400 py-2 px-1 border-b border-[#222]">
                    {d}
                  </div>
                ))}
                  {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-[#111] min-h-[72px] md:min-h-[110px] border-r border-b border-[#222]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayOccurrences = getOccurrencesForDay(day);
                  const isToday = day === today.getDate() && isCurrentMonth;
                  const occurrenceColor = (type: DayOccurrence['type'], status?: string) => {
                    if (type === 'montagem') return '#8B5CF6';
                    if (type === 'desmontagem') return '#06B6D4';
                    return getStatusColor(status);
                  };
                  return (
                    <div
                      key={day}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDayClick(day)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDayClick(day); }}
                      className={`min-h-[72px] md:min-h-[110px] p-1 md:p-1.5 text-left align-top border-r border-b border-[#222] select-none transition-colors
                        ${isToday ? 'bg-[#1a1a1a] ring-1 ring-inset ring-[#B5FF03]' : 'bg-[#111]'}
                        hover:bg-[#1a1a1a]`}
                      style={{ cursor: 'pointer !important', pointerEvents: 'auto !important' } as React.CSSProperties}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full mb-1
                        ${isToday ? 'bg-[#B5FF03] text-black' : 'text-neutral-400'}`}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayOccurrences.slice(0, 4).map(occ => {
                          const color = occurrenceColor(occ.type, occ.event.status);
                          const label = occ.type === 'montagem' ? '[M] ' : occ.type === 'desmontagem' ? '[D] ' : '';
                          return (
                            <div
                              key={occ.event.id + '-' + occ.type}
                              className="text-[8px] leading-tight px-1 py-0.5 rounded truncate font-medium text-white"
                              style={{ backgroundColor: color + '25', borderLeft: `2px solid ${color}` }}
                            >
                              {label}{occ.event.title || occ.event.client || eventTypeLabel(occ.event.eventType)}
                            </div>
                          );
                        })}
                        {dayOccurrences.length > 4 && (
                          <span className="text-[7px] text-neutral-500 pl-1">+{dayOccurrences.length - 4} mais</span>
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
                            {event.eventType && <span>{eventTypeLabel(event.eventType)}</span>}
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

        {/* Gráfico de Eventos por Status */}
        <div className="p-4 md:p-8 border-t border-[#222]">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-[#B5FF03]" aria-hidden="true" />
            <h2 className="text-lg md:text-xl font-bold text-white">Eventos por Status — {monthNames[viewMonth]} {viewYear}</h2>
          </div>
          <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart key={`chart-${viewMonth}-${viewYear}`} data={eventCountsByStatus} margin={{ top: 20, right: 20, left: 0, bottom: 10 }} barCategoryGap="30%">
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#aaaaaa', fontSize: 11, fontWeight: 700 }}
                  dy={8}
                />
                <YAxis hide />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} background={{ fill: '#1a1a1a', radius: 6 }}>
                  <LabelList
                    dataKey="value"
                    position="inside"
                    fill="#fff"
                    fontSize={20}
                    fontWeight={900}
                    offset={-8}
                  />
                  {eventCountsByStatus.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {displayLogs.length > 0 && (
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
      </>)}

      {/* HISTÓRICO DE EVENTOS */}
      {activeTab === 'eventos' && (
        <div className="bg-[#111] border border-[#333] rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Cliente</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Tipo</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Data</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Cidade</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Status</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-neutral-500 text-xs italic">Nenhum evento encontrado.</td>
                  </tr>
                ) : (
                  paginatedEvents.map(event => (
                    <tr key={event.id} className="border-b border-[#222] hover:bg-[#0a0a0a] transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{event.client || event.title || '—'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-300">{eventTypeLabel(event.eventType)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-300">{formatDate(event.date)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-300">{event.city || '—'}</td>
                      <td className="px-4 py-3">
                        {event.status ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            event.status === 'confirmado' ? 'bg-[#B5FF03] text-black' :
                            event.status === 'pendente' ? 'bg-[#f59e0b] text-white' :
                            event.status === 'cancelado' ? 'bg-[#ef4444] text-white' :
                            event.status === 'realizado' ? 'bg-[#3b82f6] text-white' :
                            'bg-[#333] text-white'
                          }`}>
                            {statusLabel[event.status] || event.status}
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            const name = event.client || event.title || 'este evento';
                            if (confirm(`Tem certeza que deseja excluir "${name}"?`)) {
                              deleteEvent(event.id);
                            }
                          }}
                           className="p-2 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Excluir evento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {paginatedEvents.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs italic">Nenhum evento encontrado.</div>
            ) : (
              <div className="divide-y divide-[#222]">
                {paginatedEvents.map(event => (
                  <div key={event.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-bold truncate">{event.client || event.title || '—'}</p>
                        <p className="text-[11px] text-neutral-400">{eventTypeLabel(event.eventType)} {event.city ? `· ${event.city}` : ''}</p>
                      </div>
                      {event.status ? (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          event.status === 'confirmado' ? 'bg-[#B5FF03] text-black' :
                          event.status === 'pendente' ? 'bg-[#f59e0b] text-white' :
                          event.status === 'cancelado' ? 'bg-[#ef4444] text-white' :
                          event.status === 'realizado' ? 'bg-[#3b82f6] text-white' :
                          'bg-[#333] text-white'
                        }`}>
                          {statusLabel[event.status] || event.status}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-300">{formatDate(event.date)}</span>
                      <button
                        onClick={() => {
                          const name = event.client || event.title || 'este evento';
                          if (confirm(`Tem certeza que deseja excluir "${name}"?`)) {
                            deleteEvent(event.id);
                          }
                        }}
                        className="p-2 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Excluir evento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#222] bg-[#0a0a0a]">
            <span className="text-[11px] text-neutral-500">
              Página {eventPage + 1} de {totalEventPages} ({safeEvents.length} registros)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={eventPage === 0}
                onClick={() => setEventPage(p => Math.max(0, p - 1))}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors min-h-[36px] ${
                  eventPage === 0
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-white hover:bg-[#222]'
                }`}
              >
                Anterior
              </button>
              <button
                disabled={eventPage >= totalEventPages - 1}
                onClick={() => setEventPage(p => Math.min(totalEventPages - 1, p + 1))}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors min-h-[36px] ${
                  eventPage >= totalEventPages - 1
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-white hover:bg-[#222]'
                }`}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTÓRICO DE ORÇAMENTOS */}
      {activeTab === 'orcamentos' && (
        <div className="bg-[#111] border border-[#333] rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Cliente</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Data de Criação</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Valor Total</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Status</th>
                  <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrcamentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-neutral-500 text-xs italic">Nenhum orçamento encontrado.</td>
                  </tr>
                ) : (
                  paginatedOrcamentos.map(lead => (
                    <tr key={lead.id} className="border-b border-[#222] hover:bg-[#0a0a0a] transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{lead.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-300">{formatDate(lead.firstContact)}</td>
                      <td className="px-4 py-3 text-sm text-[#B5FF03] font-bold">
                        {lead.value ? formatCurrency(parseMonetaryValue(lead.value)) : 'R$ 0,00'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#333] text-white">
                          {lead.stage || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja excluir o orçamento de "${lead.name || '—'}"?`)) {
                              deleteLead(lead.id);
                            }
                          }}
                           className="p-2 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Excluir orçamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {paginatedOrcamentos.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs italic">Nenhum orçamento encontrado.</div>
            ) : (
              <div className="divide-y divide-[#222]">
                {paginatedOrcamentos.map(lead => (
                  <div key={lead.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-bold truncate">{lead.name || '—'}</p>
                        <p className="text-[11px] text-neutral-400">{formatDate(lead.firstContact)}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#333] text-white">
                        {lead.stage || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#B5FF03] font-bold">
                        {lead.value ? formatCurrency(parseMonetaryValue(lead.value)) : 'R$ 0,00'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o orçamento de "${lead.name || '—'}"?`)) {
                            deleteLead(lead.id);
                          }
                        }}
                        className="p-2 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Excluir orçamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#222] bg-[#0a0a0a]">
            <span className="text-[11px] text-neutral-500">
              Página {orcPage + 1} de {totalOrcPages} ({Orçamentos.length} registros)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={orcPage === 0}
                onClick={() => setOrcPage(p => Math.max(0, p - 1))}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors min-h-[36px] ${
                  orcPage === 0
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-white hover:bg-[#222]'
                }`}
              >
                Anterior
              </button>
              <button
                disabled={orcPage >= totalOrcPages - 1}
                onClick={() => setOrcPage(p => Math.min(totalOrcPages - 1, p + 1))}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors min-h-[36px] ${
                  orcPage >= totalOrcPages - 1
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-white hover:bg-[#222]'
                }`}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESTOQUE DE EVENTOS */}
      {activeTab === 'estoque' && (
        <EstoqueDeEventos onMessage={showToast} />
      )}

      {/* Event Detail Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-t-2xl sm:rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">
                Eventos — {selectedDate}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-[#222] rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="bg-[#111] border border-[#222] rounded-lg p-4 space-y-3">
                  {/* Status badge */}
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{event.title || 'Evento'}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold text-[#B5FF03] border border-[#B5FF03]/30 hover:bg-[#B5FF03]/10 transition-colors min-h-[44px]"
                      >
                        <Pencil size={11} />
                        Editar
                      </button>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${event.status ? statusBg[event.status] : 'bg-[#333]'} ${event.status === 'confirmado' ? 'text-black' : 'text-white'}`}>
                        {event.status ? statusLabel[event.status] : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Client info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {event.client && (
                      <div className="col-span-1 sm:col-span-2">
                        <span className="text-neutral-500">Cliente:</span>{' '}
                        <span className="text-white font-medium">{event.client}</span>
                      </div>
                    )}
                    {event.clientPhone && (
              <div className="flex flex-wrap items-center gap-2">
                        <span className="text-neutral-500">Telefone:</span>{' '}
                        <span className="text-white">{event.clientPhone}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); window.open(generateWhatsAppLink(event.clientPhone!), '_blank'); }}
                          className="text-[#25D366] hover:text-[#B5FF03] transition-colors"
                          title="Enviar mensagem via WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </button>
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
                        <span className="text-[#B5FF03] font-bold">{eventTypeLabel(event.eventType)}</span>
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
                    {(event.valorTotal ?? 0) > 0 && (
                      <div>
                        <span className="text-neutral-500">Valor:</span>{' '}
                        <span className="text-[#B5FF03] font-bold">{formatCurrency(event.valorTotal!)}</span>
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
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4" onClick={() => { setEditingEventId(null); setIsCreateOpen(false); }}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-t-2xl sm:rounded-lg w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222] shrink-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">{editingEventId ? 'Editar Evento' : 'Novo Evento'}</h3>
              <button onClick={() => { setEditingEventId(null); setIsCreateOpen(false); }} className="p-1 hover:bg-[#222] rounded-md transition-colors">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            {/* Mode toggle */}
            <div className="flex border-b border-[#222] shrink-0">
              <button
                onClick={() => setAbaAtiva('cliente')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${abaAtiva === 'cliente' ? 'text-[#B5FF03] border-b-2 border-[#B5FF03]' : 'text-neutral-500 hover:text-white'}`}
              >
                Novo Cliente
              </button>
              <button
                onClick={() => setAbaAtiva('evento')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${abaAtiva === 'evento' ? 'text-[#B5FF03] border-b-2 border-[#B5FF03]' : 'text-neutral-500 hover:text-white'}`}
              >
                Novo Evento
              </button>
              <button
                onClick={async () => {
                  if (!editingEventId) {
                    const draftData = {
                      title: formData.eventType ? `${formData.eventType} - ${(formData.name || 'Novo Evento')}` : (formData.name || 'Novo Evento'),
                      client: formData.name || '',
                      clientPhone: formData.whatsapp || '',
                      clientEmail: formData.email || '',
                      clientCpf: formData.cpf || '',
                      eventType: formData.eventType || '',
                      date: formData.date || '',
                      time: formData.time || '',
                      city: formData.city || '',
                      dataMontagem: formData.dataMontagem || '',
                      dataDesmontagem: formData.dataDesmontagem || '',
                      description: formData.observacao || '',
                      status: 'pendente' as const,
                    };
                    try {
                      const newId = await addEvent(draftData);
                      if (newId) {
                        setEditingEventId(newId);
                        setAbaAtiva('despesas');
                      } else {
                        setSubmitError('Erro ao criar rascunho do evento.');
                      }
                    } catch (err) {
                      console.error('[Painel] Erro ao criar rascunho:', err);
                      setSubmitError('Erro ao criar rascunho. Tente novamente.');
                    }
                  } else {
                    setAbaAtiva('despesas');
                  }
                }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${abaAtiva === 'despesas' ? 'text-[#B5FF03] border-b-2 border-[#B5FF03]' : 'text-neutral-500 hover:text-white'}`}
              >
                {!editingEventId && <Lock size={10} />}
                Despesas do Evento
              </button>
            </div>
            {abaAtiva === 'despesas' ? (
              <div className="p-4 overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb:hover]:bg-[#555]">
                <DespesasDoEvento eventId={editingEventId} eventDate={formData.date} />
              </div>
            ) : (
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-4 overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb:hover]:bg-[#555]">
              {abaAtiva === 'cliente' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <User size={12} /> Nome
                    </label>
                    <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" />
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
                      <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg max-h-48 overflow-y-auto z-50 shadow-xl">
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-neutral-500 italic">Nenhum cliente encontrado</div>
                        ) : (
                          filteredClients.map(lead => (
                            <button
                              type="button"
                              key={lead.id}
                              onClick={() => {
                                setSelectedClientId(lead.id);
                                setClientSearch(`${lead.nome} — ${lead.whatsapp}`);
                                setClientSearchOpen(false);
                                setFormData(prev => ({
                                  ...prev,
                                  name: lead.nome,
                                  city: lead.cidade,
                                  whatsapp: lead.whatsapp,
                                }));
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-[#333] transition-colors flex items-center gap-2 ${selectedClientId === lead.id ? 'bg-[#2a2a2a] border-l-2 border-[#B5FF03]' : ''}`}
                            >
                              <User size={12} className="text-neutral-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="block truncate">{lead.nome}</span>
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
                        <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden z-50 shadow-xl">
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
                    {formData.eventType === 'Outros' && (
                      <div className="mt-3">
                        <input type="text" value={formData.outroEventoType} onChange={e => setFormData(prev => ({ ...prev, outroEventoType: e.target.value }))}
                          placeholder="Especifique o tipo de evento..."
                          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none" />
                      </div>
                    )}
                  </div>
                  {/* Cidade */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={12} /> Cidade
                    </label>
                    <input type="text" value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Ex: São Paulo, SP"
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <CalendarDays size={12} /> Data do Evento
                      </label>
                      <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" style={{ colorScheme: 'dark' }} required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <Clock size={12} /> Horário
                      </label>
                      <input type="time" value={formData.time} onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" />
                    </div>
                  </div>
                  {/* Data de Montagem e Desmontagem */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <CalendarDays size={12} /> Data de Montagem
                      </label>
                      <input type="date" value={formData.dataMontagem} onChange={e => setFormData(prev => ({ ...prev, dataMontagem: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <CalendarDays size={12} /> Data de Desmontagem
                      </label>
                      <input type="date" value={formData.dataDesmontagem} onChange={e => setFormData(prev => ({ ...prev, dataDesmontagem: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none" style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>
                  {/* Status do Evento */}
                  <div ref={statusRef}>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <CalendarDays size={12} /> Status do Evento
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setStatusOpen(prev => !prev)}
                        className={`w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 transition-colors ${formData.status ? 'text-white' : 'text-neutral-500'} focus:border-[#B5FF03] outline-none`}
                      >
                        <span>{formData.status ? statusLabel[formData.status] || formData.status : 'Selecionar...'}</span>
                        <ChevronDown size={14} className={`text-neutral-500 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {statusOpen && (
                        <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden z-50 shadow-xl">
                          {Object.entries(statusLabel).map(([key, label]) => (
                            <button
                              type="button"
                              key={key}
                              onClick={() => { setFormData(prev => ({ ...prev, status: key })); setStatusOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${formData.status === key ? 'bg-[#2a2a2a] text-[#B5FF03] font-bold' : 'text-white hover:bg-[#333]'}`}
                            >
                              <div className={`w-2.5 h-2.5 rounded-full ${statusBg[key]}`} />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Itens do Orçamento */}
                  <div className="border-t border-[#222] pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Itens do Orçamento</p>
                      <button type="button" onClick={() => { setOrcSearch(''); setOrcSearchOpen(true); }}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#B5FF03] hover:text-white transition-colors">
                        <Plus size={12} /> Adicionar Item
                      </button>
                    </div>

                    {/* Orçamento search combobox */}
                    {orcSearchOpen && (
                      <div ref={orcSearchRef} className="mb-3">
                        {showCreateItemForm || orcamentoItems.length === 0 ? (
                          <div className="bg-[#111] border border-[#333] rounded-lg p-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Criar item no estoque de eventos</p>
                            <input
                              type="text"
                              value={newItemForm.name}
                              onChange={e => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Nome do item (obrigatório)"
                              className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#B5FF03]"
                              autoFocus
                              autoComplete="off"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={newItemForm.category}
                                onChange={e => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#B5FF03] [color-scheme:dark]"
                              >
                                {EVENT_STOCK_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={newItemForm.quantity}
                                onChange={e => setNewItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                                placeholder="Quantidade"
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#B5FF03] [color-scheme:dark]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={newItemForm.unit}
                                onChange={e => setNewItemForm(prev => ({ ...prev, unit: e.target.value }))}
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#B5FF03] [color-scheme:dark]"
                              >
                                {EVENT_STOCK_UNITS.map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newItemForm.valorReferencia}
                                onChange={e => setNewItemForm(prev => ({ ...prev, valorReferencia: e.target.value }))}
                                placeholder="Valor ref. R$ (interno)"
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#B5FF03] [color-scheme:dark]"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={newItemForm.observacao}
                              onChange={e => setNewItemForm(prev => ({ ...prev, observacao: e.target.value }))}
                              placeholder="Observação interna (não exportada)..."
                              className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#B5FF03] resize-none"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCreateItemForm(false);
                                  if (orcamentoItems.length === 0) setOrcSearchOpen(false);
                                }}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleCreateEventItem}
                                disabled={!newItemForm.name.trim()}
                                className="flex items-center gap-1.5 px-3 py-2 bg-[#B5FF03] text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#a1e600] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Plus size={12} /> Salvar e adicionar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center bg-[#111] border border-[#333] rounded-lg overflow-hidden focus-within:border-[#B5FF03] transition-colors">
                              <Search size={14} className="text-neutral-500 ml-3 shrink-0" />
                              <input
                                type="text"
                                value={orcSearch}
                                onChange={e => setOrcSearch(e.target.value)}
                                onFocus={() => setOrcSearchOpen(true)}
                                placeholder="Buscar item no orçamento..."
                                className="w-full bg-transparent border-none px-2 py-2 text-sm text-white placeholder-neutral-600 outline-none"
                                autoFocus
                                autoComplete="off"
                              />
                              <button type="button" onClick={() => setOrcSearchOpen(false)}
                                className="p-2 hover:bg-[#222] transition-colors">
                                <X size={14} className="text-neutral-500" />
                              </button>
                            </div>
                            <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg max-h-44 overflow-y-auto shadow-xl">
                              {filteredOrcItems.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-neutral-500 italic">Nenhum item no estoque de eventos</div>
                              ) : (
                                filteredOrcItems.map(item => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => handleAdicionarItem(item)}
                                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#333] transition-colors flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="truncate">{item.name}</span>
                                      {item.category && (
                                        <span className="text-[9px] text-neutral-500 uppercase shrink-0">{item.category}</span>
                                      )}
                                    </div>
                                    <span className="text-neutral-400 font-bold shrink-0 text-[11px]">{item.quantity} {item.unit}</span>
                                  </button>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowCreateItemForm(true)}
                              className="mt-1 w-full flex items-center justify-center gap-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#B5FF03] hover:bg-[#222] transition-colors rounded-lg"
                            >
                              <Plus size={12} /> Criar novo item
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {formData.orcamentoItems.map((item, idx) => {
                        const isExpanded = expandedItems.has(item.id);
                        return isExpanded ? (
                          <div key={item.id} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Item {idx + 1}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setExpandedItems(prev => { const next = new Set(prev); next.delete(item.id); return next; })}
                                  className="p-1 hover:bg-[#333] rounded-md transition-colors">
                                  <CheckSquare size={14} className="text-[#B5FF03]" />
                                </button>
                                <button type="button" onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 hover:bg-[#333] rounded-md transition-colors">
                                  <Trash2 size={12} className="text-red-400" />
                                </button>
                              </div>
                            </div>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => { setEditingItemId(editingItemId === item.id ? null : item.id); setInlineItemSearch(''); }}
                                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-left text-white flex items-center justify-between gap-2 hover:border-[#B5FF03] transition-colors"
                              >
                                <span className="truncate">{item.item}</span>
                                <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                              </button>
                              {editingItemId === item.id && (
                                <div className="mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden z-50 shadow-xl">
                                  <div className="flex items-center bg-[#111] border-b border-[#333]">
                                    <Search size={12} className="text-neutral-500 ml-3 shrink-0" />
                                    <input
                                      type="text"
                                      value={inlineItemSearch}
                                      onChange={e => setInlineItemSearch(e.target.value)}
                                      placeholder="Buscar item..."
                                      className="w-full bg-transparent border-none px-2 py-2 text-xs text-white placeholder-neutral-600 outline-none"
                                      autoFocus
                                      autoComplete="off"
                                    />
                                  </div>
                                  <div className="max-h-40 overflow-y-auto">
                                    {(inlineItemSearch.trim()
                                      ? filteredOrcItems.filter(i =>
                                          i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
                                            inlineItemSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                          )
                                        )
                                      : orcamentoItems
                                    ).slice(0, 30).map(opt => (
                                        <button
                                          type="button"
                                          key={opt.id}
                                          onClick={() => handleInlineItemSelect(item.id, opt)}
                                          className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333] transition-colors flex items-center justify-between gap-2 ${item.item === `${opt.name} — ${item.qtdAtual} ${opt.unit}` ? 'bg-[#2a2a2a] border-l-2 border-[#B5FF03]' : ''}`}
                                        >
                                          <span className="truncate">{opt.name}</span>
                                          <span className="text-neutral-500 text-[9px] uppercase shrink-0">{opt.quantity} {opt.unit}</span>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-1">Qtd</label>
                                <input type="number" min="1" value={item.qtdAtual} onChange={e => handleItemChange(item.id, 'qtdAtual', e.target.value)}
                                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#B5FF03] outline-none" />
                              </div>
                              {item.semPreco ? (
                                <div>
                                  <label className="block text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-1">Valor</label>
                                  <div className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-sm text-neutral-500">
                                    Sem preço (interno)
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-1">Valor Unit.</label>
                                  <input type="number" min="0" step="0.01" value={item.valorUnit} onChange={e => handleItemChange(item.id, 'valorUnit', e.target.value)}
                                    className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#B5FF03] outline-none" />
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-neutral-400">Total: </span>
                              <span className="text-[11px] text-white font-bold">R$ {(item.qtdAtual * item.valorUnit).toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <div key={item.id} className="flex items-center justify-between py-2 px-1 border-b border-[#222] last:border-b-0">
                            <span className="text-sm text-white">
                              <span className="text-[#B5FF03] font-bold">{item.qtdAtual}x</span>
                              {' '}{item.item}
                              {item.semPreco
                                ? <span className="text-neutral-500 ml-2 text-[10px] italic">sem preço</span>
                                : <span className="text-neutral-400 ml-2">R$ {(item.qtdAtual * item.valorUnit).toFixed(2)}</span>}
                            </span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setExpandedItems(prev => { const next = new Set(prev); next.add(item.id); return next; })}
                                className="p-1 hover:bg-[#333] rounded-md transition-colors">
                                <Pencil size={12} className="text-neutral-400" />
                              </button>
                              <button type="button" onClick={() => handleRemoveItem(item.id)}
                                className="p-1 hover:bg-[#333] rounded-md transition-colors">
                                <Trash2 size={12} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {formData.orcamentoItems.length === 0 && !orcSearchOpen && (
                        <div className="text-center py-3 bg-[#111] border border-dashed border-[#333] rounded-lg">
                          <p className="text-[10px] text-neutral-500 italic">Clique em "Adicionar Item" para buscar ou criar itens no estoque de eventos</p>
                        </div>
                      )}
                    </div>

                    {/* Financial footer */}
                    <div className="border-t border-[#333] pt-3 mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Subtotal dos Equipamentos</span>
                        <span className="text-white font-bold">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 shrink-0">Desconto (R$)</label>
                        <input type="number" min="0" step="0.01" value={formData.desconto}
                          onChange={e => setFormData(prev => ({ ...prev, desconto: Math.max(0, Number(e.target.value) || 0) }))}
                          className="w-28 bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-white text-right focus:border-[#B5FF03] outline-none" />
                      </div>
                      <div className="border-t border-[#222] pt-2 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor Total do Aluguel</span>
                        <span className="text-base font-black text-white">R$ {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Observação */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={12} /> Observação
                    </label>
                    <textarea value={formData.observacao} onChange={e => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                      placeholder="Informações adicionais sobre o evento..."
                      rows={3}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none resize-none" />
                  </div>
                </div>
              </div>
              {submitError && (
                <div className="px-4 py-3 bg-red-900/20 border-t border-red-900/40">
                  <p className="text-[11px] text-red-400 font-bold">{submitError}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {editingEventId && (
                  <button type="button" onClick={handleDeleteEvent}
                    className="px-3 py-3 bg-transparent border border-[#EF4444]/40 text-[#EF4444] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#EF4444]/10 hover:border-[#EF4444] transition-all flex items-center justify-center gap-2 shrink-0">
                    <Trash2 size={14} />
                    EXCLUIR
                  </button>
                )}
                <button type="button" onClick={handleExportPDF}
                  className="flex-1 py-3 bg-[#1a1a1a] border border-[#333] text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#222] hover:border-[#555] transition-all flex items-center justify-center gap-2 min-w-0">
                  <FileText size={14} />
                  EXPORTAR (PDF)
                </button>
                <button type="button" onClick={handleSendWhatsApp}
                  className="flex-1 py-3 bg-[#1a1a1a] border border-[#25D366]/40 text-[#25D366] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#25D366]/10 hover:border-[#25D366] transition-all flex items-center justify-center gap-2 min-w-0">
                  <MessageCircle size={14} />
                  ENVIAR WHATSAPP
                </button>
                <button type="submit"
                  className="flex-[1.5] py-3 bg-[#B5FF03] text-black font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors text-center leading-tight">
                  {editingEventId ? 'Salvar Alterações' : abaAtiva === 'cliente' ? 'Cadastrar e Agendar' : 'Agendar Evento'}
                </button>
              </div>
            </form>)}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] bg-[#B5FF03] text-black text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;