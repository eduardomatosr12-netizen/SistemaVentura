import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ReactNode } from 'react';
import { Plus, Pencil, Trash2, X, Save, Filter, XCircle, ChevronDown, ChevronUp, AlertCircle, MessageCircle, Package, Search, FileText, Percent, DollarSign } from 'lucide-react';
import WhatsAppModal from '../../components/WhatsAppModal';
import { useCRM, type Lead, type OrcamentoItem } from '../../contexts/CRMContext';
import { useFilters } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateUUID } from '../../lib/uuid';
import { getAllInventoryItems, getAvailableQuantity, deductInventory, restoreInventory } from '../../lib/inventory';
import { generatePDF } from '../../lib/crmHelpers';
import { addTransaction } from '../../services/financeService';

const formatBRL = (val: string) => {
  const numeric = val.replace(/\D/g, '');
  if (!numeric) return '';
  const num = parseFloat(numeric) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const parseMonetaryValue = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
};

const EMPTY_LEAD: Partial<Lead> = {
  name: '', niche: '', whatsapp: '', email: '', instagram: '',
  stage: 'Novos Orçamentos', firstContact: '', closingDate: '',
  followUpReminder: '', address: '',
  notes: '', value: '', items: [],
};

const EVENT_TYPES = [
  'Aniversário',
  'Casamento',
  'Corporativo',
  'Privado',
  'Outros'
];

const baseStageStyle = 'bg-[#1a1a1a] text-white/70 text-center text-sm leading-5 rounded-full px-4 py-1.5 min-w-[120px] border border-gray-700 inline-flex items-center justify-center';

const stageStyle: Record<string, string> = {
  'Novos Orçamentos':      baseStageStyle,
  'Primeiro Contato': baseStageStyle,
  'Contato Ativo':    baseStageStyle,
  'Reunião Agendada': baseStageStyle,
  'Follow Up':        baseStageStyle,
  'Proposta Enviada': baseStageStyle,
  'Contrato Fechado': baseStageStyle,
  'Perdido':          baseStageStyle,
};

const FilterSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1a1a1a] px-3 py-2">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between w-full text-left py-1"
      >
        <span className="text-[9px] font-black text-white uppercase tracking-widest">{title}</span>
        {isOpen ? <ChevronUp size={12} className="text-[#B5FF03]" /> : <ChevronDown size={12} className="text-[#B5FF03]" />}
      </button>
      {isOpen && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
};

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{color: '#B5FF03'}}>
      {label}{required && <span className="text-white ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full bg-[#1a1a1a] border border-gray-700 rounded-md py-2.5 px-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#B5FF03] transition-colors';

// PDF Generation
const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const CRMOrçamentos = () => {
  const { Orçamentos, events, addLead, updateLead, deleteLead, searchTerm } = useCRM();
  const { clearFilters } = useFilters();
  const { role, employeeName } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<Lead>>(EMPTY_LEAD);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<Lead | null>(null);

  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemVal, setNewItemVal] = useState(0);
  const [invSearch, setInvSearch] = useState('');
  const [showInvDropdown, setShowInvDropdown] = useState(false);
  const [invStockItems, setInvStockItems] = useState<{ name: string; qty: number; category: string }[]>([]);
  const invDropdownRef = useRef<HTMLDivElement>(null);

  // Discount state
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);

  // Month filter
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Event type filter
  const [eventType, setEventType] = useState<string>('');

  // City filter
  const [citySearch, setCitySearch] = useState<string>('');

  useEffect(() => {
    setInvStockItems(getAllInventoryItems());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setInvStockItems(getAllInventoryItems());
      setInvSearch('');
      setShowInvDropdown(false);
      const lead = Orçamentos.find(o => o.id === current.id);
      if (lead?.items) {
        const total = lead.items.reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
        if (total > 0 && lead.value) {
          const leadValue = parseMonetaryValue(lead.value);
          if (leadValue < total) {
            const diff = total - leadValue;
            const pct = Math.round((diff / total) * 100);
            if (diff > 0 && pct > 0) {
              setDiscountType('percent');
              setDiscountValue(pct);
            } else {
              setDiscountValue(0);
            }
          } else {
            setDiscountValue(0);
          }
        } else {
          setDiscountValue(0);
        }
      }
    }
  }, [isOpen]);

  const filteredInvItems = useMemo(() => {
    if (!invSearch.trim()) return invStockItems.slice(0, 50);
    const q = invSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return invStockItems.filter(i =>
      i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    ).slice(0, 50);
  }, [invStockItems, invSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (invDropdownRef.current && !invDropdownRef.current.contains(e.target as Node)) {
        setShowInvDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate discount
  const calculateDiscount = useCallback((items: OrcamentoItem[], discountT: string, discountV: number) => {
    const total = items.reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
    if (discountV <= 0) return { total, discountedTotal: total, discountAmount: 0 };
    if (discountT === 'percent') {
      const amount = total * (discountV / 100);
      return { total, discountedTotal: total - amount, discountAmount: amount };
    }
    return { total, discountedTotal: Math.max(0, total - discountV), discountAmount: discountV };
  }, []);

  // Update the value field when items or discount changes
  useEffect(() => {
    if (current.items && current.items.length > 0) {
      const { discountedTotal } = calculateDiscount(current.items, discountType, discountValue);
      const formatted = formatCurrency(discountedTotal);
      setCurrent(prev => ({ ...prev, value: formatted }));
    }
  }, [current.items, discountType, discountValue, calculateDiscount]);

  const addItem = () => {
    if (!newItemDesc.trim()) return;

    const eventDate = current.firstContact || '';
    const available = getAvailableQuantity(newItemDesc.trim(), eventDate);
    if (newItemQty > available) {
      alert(`Estoque insuficiente! Disponível apenas: ${available}`);
      return;
    }

    const item: OrcamentoItem = {
      id: generateUUID(),
      descricao: newItemDesc.trim(),
      quantidade: newItemQty,
      valorUnitario: newItemVal,
    };
    const updatedItems = [...(current.items || []), item];
    setCurrent(prev => ({ ...prev, items: updatedItems }));
    const { discountedTotal } = calculateDiscount(updatedItems, discountType, discountValue);
    const formatted = formatCurrency(discountedTotal);
    updateField('value', formatted);
    setNewItemDesc('');
    setInvSearch('');
    setNewItemQty(1);
    setNewItemVal(0);
  };

  const removeItem = (id: string) => {
    const updatedItems = (current.items || []).filter(i => i.id !== id);
    setCurrent(prev => ({ ...prev, items: updatedItems }));
    const { discountedTotal } = calculateDiscount(updatedItems, discountType, discountValue);
    const formatted = formatCurrency(discountedTotal);
    updateField('value', formatted);
  };

  const handleItemSelect = (name: string) => {
    setNewItemDesc(name);
    setInvSearch(name);
    setShowInvDropdown(false);
    const found = invStockItems.find(i => i.name === name);
    if (found) {
      setNewItemVal(0);
    }
  };

  const openAdd = () => { setMode('add'); setCurrent(EMPTY_LEAD); setIsOpen(true); setDiscountValue(0); };
  const openEdit = (lead: Lead) => {
    if (lead.id.startsWith('event-')) {
      alert('Este cliente veio de um evento no calendário. Para editar, vá até o Calendário.');
      return;
    }
    setMode('edit');
    setCurrent({ ...lead });
    setIsOpen(true);
    if (lead.items && lead.items.length > 0) {
      const total = lead.items.reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
      if (total > 0) {
        const leadValue = parseMonetaryValue(lead.value);
        if (leadValue < total) {
          const diff = total - leadValue;
          const pct = Math.round((diff / total) * 100);
          if (diff > 0) {
            setDiscountType('percent');
            setDiscountValue(pct);
          } else {
            setDiscountValue(0);
          }
        } else {
          setDiscountValue(0);
        }
      }
    } else {
      setDiscountValue(0);
    }
  };

  // Add pending revenue when a lead becomes "Contrato Fechado"
  const addPendingRevenue = (leadName: string, value: string, closingDate: string, numInstallments?: number) => {
    const storageKey = 'axium_finance_v1';
    const stored = localStorage.getItem(storageKey);
    const finance = stored ? JSON.parse(stored) : { manualInvoices: [] };
    
    const pendingInvoice = {
      id: `lead-revenue-${generateUUID()}`,
      client: leadName,
      amount: value,
      date: closingDate || new Date().toISOString().split('T')[0],
      status: 'Pendente',
      source: 'lead',
      paymentMethod: numInstallments && numInstallments > 1 ? 'parcelado' : 'pix',
      installments: numInstallments && numInstallments > 1 ? String(numInstallments) : undefined,
      lastModifiedBy: employeeName || 'Sistema',
    };

    finance.manualInvoices = [...(finance.manualInvoices || []), pendingInvoice];
    localStorage.setItem(storageKey, JSON.stringify(finance));

    addTransaction({
      client: leadName,
      description: `Orçamento fechado - ${leadName}`,
      amount: parseMonetaryValue(value),
      date: closingDate || new Date().toISOString().split('T')[0],
      status: 'Pendente',
      type: 'receita',
      source: 'lead',
    });

    // If parcelado, create projected revenues for future months
    if (numInstallments && numInstallments > 1) {
      const totalValue = parseMonetaryValue(value);
      const installmentValue = totalValue / numInstallments;
      const baseDate = closingDate ? new Date(closingDate) : new Date();

      for (let i = 1; i < numInstallments; i++) {
        const projectedDate = new Date(baseDate);
        projectedDate.setMonth(projectedDate.getMonth() + i);
        const projectedInvoice = {
          id: `lead-revenue-proj-${generateUUID()}`,
          client: `${leadName} (Parcela ${i + 1}/${numInstallments})`,
          amount: formatCurrency(installmentValue),
          date: projectedDate.toISOString().split('T')[0],
          status: 'Pendente',
          source: 'lead',
          paymentMethod: 'parcelado',
          installments: String(numInstallments),
          lastModifiedBy: 'Sistema (Projeção)',
        };
        finance.manualInvoices.push(projectedInvoice);
      }
      localStorage.setItem(storageKey, JSON.stringify(finance));
    }
  };

  const getFinalValue = (): string => {
    if (!current.items || current.items.length === 0) return current.value || 'R$ 0,00';
    const total = current.items.reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
    if (discountValue <= 0) return formatCurrency(total);
    if (discountType === 'percent') {
      return formatCurrency(total - (total * discountValue / 100));
    }
    return formatCurrency(Math.max(0, total - discountValue));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const isFechado = current.stage === 'Contrato Fechado';
    const modifiedLead = {
      ...current,
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário')
    };
    
    const finalValue = getFinalValue();
    
    const doInventoryOps = async () => {
      if (mode === 'add') {
        addLead(modifiedLead as Omit<Lead, 'id'>);
        if (isFechado && current.items && current.items.length > 0) {
          await Promise.all(current.items.map(item => deductInventory(item.descricao, item.quantidade)));
          addPendingRevenue(current.name || 'Cliente', finalValue, current.firstContact || '');
        }
      } else {
        const prevLead = Orçamentos.find(o => o.id === current.id);
        const wasFechado = prevLead?.stage === 'Contrato Fechado';

        if (wasFechado && !isFechado) {
          if (prevLead?.items) {
            await Promise.all(prevLead.items.map(item => restoreInventory(item.descricao, item.quantidade)));
          }
        }

        if (isFechado && current.items && current.items.length > 0) {
          if (wasFechado && prevLead?.items) {
            await Promise.all(prevLead.items.map(item => restoreInventory(item.descricao, item.quantidade)));
          }
          await Promise.all(current.items.map(item => deductInventory(item.descricao, item.quantidade)));

          if (!wasFechado) {
            addPendingRevenue(current.name || 'Cliente', finalValue, current.firstContact || '');
          }
        }

        updateLead(current.id!, modifiedLead);
      }
      setIsOpen(false);
    };
    doInventoryOps();
  };

  const handleDelete = (id: string | undefined) => {
    if (!id) return;
    if (id.startsWith('event-')) {
      alert('Este cliente veio de um evento no calendário. Para excluir, vá até o Calendário.');
      return;
    }
    if (confirm('Excluir este lead?')) deleteLead(id);
  };

  const updateField = (field: keyof Lead, val: string) =>
    setCurrent(prev => ({ ...prev, [field]: val }));

  const unifiedClients = useMemo(() => {
    const eventStageMap: Record<string, string> = {
      confirmado: 'Contrato Fechado',
      realizado: 'Concluído',
      pendente: 'Novos Orçamentos',
      cancelado: 'Perdido',
    };

    const map = new Map<string, Lead>();

    Orçamentos.forEach(lead => {
      if (lead.name) map.set(lead.name.toLowerCase().trim(), lead);
    });

    events.forEach(ev => {
      const key = (ev.client || '').toLowerCase().trim();
      if (!key) return;

      if (map.has(key)) {
        const existing = map.get(key)!;
        if (ev.valorTotal) {
          const current = parseMonetaryValue(existing.value);
          existing.value = formatCurrency(current + ev.valorTotal);
        }
      } else {
        const stage = ev.status ? (eventStageMap[ev.status] || 'Novos Orçamentos') : 'Novos Orçamentos';
        map.set(key, {
          id: `event-${ev.id}`,
          name: ev.client || '',
          niche: ev.eventType || ev.title || '',
          whatsapp: ev.clientPhone || '',
          email: ev.clientEmail || '',
          instagram: '',
          stage,
          origin: 'evento',
          firstContact: ev.date || '',
          closingDate: '',
          followUpReminder: '',
          address: '',
          notes: ev.description || '',
          value: ev.valorTotal ? formatCurrency(ev.valorTotal) : 'R$ 0,00',
          items: [],
        });
      }
    });

    return Array.from(map.values());
  }, [Orçamentos, events]);

  const filteredOrçamentos = useMemo(() => {
    if (!unifiedClients || !Array.isArray(unifiedClients)) return [];
    let result = unifiedClients;

    if (searchTerm) {
      result = result.filter(lead => 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.niche?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Event type filter
    if (eventType) {
      result = result.filter(lead => lead.niche === eventType);
    }

    // City filter
    if (citySearch) {
      result = result.filter(lead =>
        lead.address?.toLowerCase().includes(citySearch.toLowerCase())
      );
    }

    // Month filter
    if (selectedMonth) {
      result = result.filter(lead => {
        if (!lead.firstContact) return false;
        const month = lead.firstContact.substring(5, 7);
        return month === selectedMonth;
      });
    }

    return result;
  }, [unifiedClients, searchTerm, eventType, citySearch, selectedMonth]);

  const hasActiveFilters = selectedMonth !== '' || eventType !== '' || citySearch !== '';

  const handleClearFilters = () => {
    setSelectedMonth('');
    setEventType('');
    setCitySearch('');
    clearFilters();
  };

  const calculateItemsTotal = (items?: OrcamentoItem[]) => {
    return (items || []).reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
  };

  return (
    <>
    <div className="relative min-h-screen">
      {isSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute top-14 left-4 w-[280px] max-h-[80vh] bg-[#111] border border-[#333] rounded-xl shadow-xl overflow-y-auto z-50">
            <div className="p-3 sticky top-0 bg-[#111] border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Contatos</h2>
                  <p className="text-[#B5FF03] text-xs md:text-sm">
                    {filteredOrçamentos.length} contato{filteredOrçamentos.length !== 1 ? 's' : ''} encontrado{filteredOrçamentos.length !== 1 ? 's' : ''}
                    {hasActiveFilters && <span className="text-[#B5FF03]"> (filtrado{filteredOrçamentos.length !== 1 ? 's' : ''})</span>}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-[#222] rounded-md transition-colors"
              >
                <X size={14} className="text-[#B5FF03]" />
              </button>
            </div>
            {hasActiveFilters && (
              <button 
                onClick={handleClearFilters}
                className="text-[10px] font-bold text-[#B5FF03] hover:text-red-500 transition-colors flex items-center gap-1 px-3 py-2 border-b border-[#1a1a1a] w-full"
              >
                <XCircle size={10} />
                Limpar filtros
              </button>
            )}

            <FilterSection title="Filtro por Data">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none"
              >
                <option value="">Todos os meses</option>
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </FilterSection>

            <FilterSection title="Tipo de Evento">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white focus:ring-1 focus:ring-[#B5FF03] outline-none"
              >
                <option value="">Todos os tipos</option>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FilterSection>

            <FilterSection title="Cidade">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Digite o nome da cidade..."
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-xs font-bold text-white placeholder-neutral-500 focus:ring-1 focus:ring-[#B5FF03] outline-none"
              />
            </FilterSection>
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-4 mb-2 md:mb-4">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters || selectedMonth ? 'bg-[#111] text-white border-[#333]' : 'bg-transparent border-transparent text-[#B5FF03] hover:text-[#B5FF03] hover:bg-[#0a0a0a]'}`}
                >
                  <Filter size={16} strokeWidth={hasActiveFilters || selectedMonth ? 2.5 : 1.5} />
                  {(hasActiveFilters || selectedMonth) && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                  )}
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] font-medium rounded opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden md:block">
                  Filtros
                </span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Contatos</h1>
                <p className="text-neutral-500 text-xs md:text-sm">
                  {filteredOrçamentos.length} contato{filteredOrçamentos.length !== 1 ? 's' : ''} encontrado{filteredOrçamentos.length !== 1 ? 's' : ''}
                  {hasActiveFilters && <span className="text-[#B5FF03]"> (filtrado{filteredOrçamentos.length !== 1 ? 's' : ''})</span>}
                </p>
              </div>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-all whitespace-nowrap">
              <Plus size={15} strokeWidth={2.5} />
              <span className="hidden sm:inline">Novo Contato</span>
              <span className="sm:hidden text-xs">Novo</span>
            </button>
          </div>

          <div className="bg-[#0a0a0a] border border-[#333] rounded-md overflow-x-auto shadow-sm">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] bg-[#111]">
                  {['NOME', 'WHATSAPP', 'INSTAGRAM', 'VALOR', 'ETAPA DO PIPELINE', 'AÇÕES'].map((h, i) => (
                    <th key={h} className={`px-3 md:px-5 py-2 md:py-3.5 text-[10px] md:text-[11px] text-[#B5FF03] font-semibold uppercase tracking-wider whitespace-nowrap ${i >= 4 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {Array.isArray(filteredOrçamentos) && filteredOrçamentos.length > 0 ? filteredOrçamentos.map(lead => (
                  <tr key={lead?.id} className="hover:bg-[#111] transition-colors group">
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <div className="font-semibold text-white text-xs md:text-sm">{lead?.name}</div>
                      <div className="text-[10px] md:text-xs text-neutral-400 truncate">{lead?.niche} · {lead?.email}</div>
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-neutral-400 text-xs md:text-sm whitespace-nowrap">
                      {lead?.whatsapp ? (
                        <div className="flex items-center gap-1.5">
                          <span>{lead.whatsapp}</span>
                          <button
                            type="button"
                            onClick={() => setWhatsAppTarget(lead)}
                            className="text-[#25D366] hover:text-[#B5FF03] transition-colors"
                            title="Enviar mensagem via WhatsApp"
                          >
                            <MessageCircle size={14} className="md:w-4 md:h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#B5FF03]">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-neutral-400 text-xs md:text-sm whitespace-nowrap">{lead?.instagram}</td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-white font-medium text-xs md:text-sm whitespace-nowrap">{lead?.value || '—'}</td>
                    <td className="px-3 md:px-5 py-4 md:py-6 text-center">
                      <span className={`${stageStyle[lead?.stage] ?? baseStageStyle}`}>
                        {lead?.stage === 'Novos Orçamentos' ? 'Novos Contatos' : lead?.stage}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <div className="flex items-center justify-center gap-0.5 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(lead)} className="p-1 md:p-1.5 text-neutral-400 hover:text-white hover:bg-[#111] rounded-md transition-all">
                          <Pencil size={12} className="md:w-3.5 md:h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(lead?.id)} className="p-1 md:p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                          <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-3 md:px-5 py-8 md:py-12 text-center text-neutral-400 font-medium italic text-xs md:text-sm">
                      {hasActiveFilters ? 'Nenhum cliente encontrado com os filtros aplicados' : `Nenhum cliente encontrado para "${searchTerm}"`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 mt-3">
              {Array.isArray(filteredOrçamentos) && filteredOrçamentos.length > 0 ? filteredOrçamentos.map(lead => (
                <div key={lead?.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2.5">
                  <div>
                    <div className="font-semibold text-white text-sm">{lead?.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{lead?.niche} · {lead?.email}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <span className="text-neutral-500 font-medium">WhatsApp:</span>
                    {lead?.whatsapp ? (
                      <div className="flex items-center gap-1">
                        <span>{lead.whatsapp}</span>
                        <button
                          type="button"
                          onClick={() => setWhatsAppTarget(lead)}
                          className="text-[#25D366] hover:text-[#B5FF03] transition-colors"
                        >
                          <MessageCircle size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#B5FF03]">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <span className="text-neutral-500 font-medium">Instagram:</span>
                    <span>{lead?.instagram || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-500 font-medium">Valor:</span>
                    <span className="text-white font-medium">{lead?.value || '—'}</span>
                  </div>
                  <div className="flex justify-center pt-1 w-full">
                    <span className={`${stageStyle[lead?.stage] ?? baseStageStyle}`}>
                      {lead?.stage === 'Novos Orçamentos' ? 'Novos Contatos' : lead?.stage}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => openEdit(lead)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#1a1a1a] rounded-md transition-all">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(lead?.id)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center text-neutral-400 font-medium italic text-xs py-8">
                  {hasActiveFilters ? 'Nenhum cliente encontrado com os filtros aplicados' : `Nenhum cliente encontrado para "${searchTerm}"`}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] w-full max-w-sm md:max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start md:items-center gap-3 px-4 md:px-7 py-3 md:py-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                  {mode === 'add' ? 'Novo Evento' : 'Editar Evento'}
                </h2>
                <p className="text-[10px] md:text-xs text-[#B5FF03] mt-0.5 md:mt-0.5">
                  {mode === 'add' ? 'Preencha os dados para cadastrar um novo evento.' : `Editando: ${current.name}`}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#B5FF03] hover:text-white transition-colors p-1 flex-shrink-0" type="button">
                <X size={20} className="w-5 h-5 md:w-5 md:h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto flex-1">
              <div className="px-4 md:px-7 py-4 md:py-6 space-y-3 md:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="NOME" required>
                    <input type="text" value={current.name} onChange={e => updateField('name', e.target.value)}
                      required className={inputCls} placeholder="Ex: João Silva" />
                  </Field>
                  <Field label="TIPO DE EVENTO">
                    {(() => {
                      const predefined = ['Aniversário', 'Casamento', 'Corporativo', 'Privado', 'Outros'];
                      const isCustom = current.niche && !predefined.includes(current.niche);
                      return (
                        <>
                          <select
                            value={isCustom ? 'Outros' : (current.niche || '')}
                            onChange={e => updateField('niche', e.target.value)}
                            className={`${inputCls} appearance-none cursor-pointer`}
                          >
                            <option value="">Selecione...</option>
                            <option value="Aniversário">Aniversário</option>
                            <option value="Casamento">Casamento</option>
                            <option value="Corporativo">Corporativo</option>
                            <option value="Privado">Privado</option>
                            <option value="Outros">Outros</option>
                          </select>
                          {(current.niche === 'Outros' || isCustom) && (
                            <input
                              type="text"
                              value={isCustom ? current.niche : ''}
                              onChange={e => updateField('niche', e.target.value)}
                              className={`${inputCls} mt-2`}
                              placeholder="Especifique o Evento"
                              required
                            />
                          )}
                        </>
                      );
                    })()}
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="WHATSAPP">
                    <input type="text" value={current.whatsapp} onChange={e => updateField('whatsapp', e.target.value)}
                      className={inputCls} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="INSTAGRAM">
                    <input type="text" value={current.instagram} onChange={e => updateField('instagram', e.target.value)}
                      className={inputCls} placeholder="@Usuário" />
                  </Field>
                </div>

                <Field label="CIDADE">
                  <input type="text" value={current.address} onChange={e => updateField('address', e.target.value)}
                    className={inputCls} placeholder="Ex: São Paulo - SP" />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="DATA DO EVENTO">
                    <input type="date" value={current.firstContact} onChange={e => updateField('firstContact', e.target.value)}
                      className={`${inputCls} [color-scheme:light]`} />
                  </Field>
                  <Field label="DATA DE FECHAMENTO">
                    <input type="date" value={current.closingDate} onChange={e => updateField('closingDate', e.target.value)}
                      className={`${inputCls} [color-scheme:light]`} />
                  </Field>
                </div>

                <Field label="DECORADOR">
                  <input type="text" value={current.followUpReminder} onChange={e => updateField('followUpReminder', e.target.value)}
                    className={inputCls} placeholder="Nome do decorador" />
                </Field>

                <Field label="OBSERVAÇÕES">
                  <textarea value={current.notes} onChange={e => updateField('notes', e.target.value)}
                    rows={4} className={`${inputCls} resize-none`}
                    placeholder="Notas internas, contexto do lead..." />
                </Field>

                {/* Itens do Orçamento */}
                <div className="border-t border-[#333] pt-4 mt-2">
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color: '#B5FF03'}}>
                    <Package size={14} /> ITENS DO ORÇAMENTO
                  </label>

                  {current.items && current.items.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {current.items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2">
                          <span className="flex-1 text-white text-sm font-medium truncate">{item.descricao}</span>
                          <span className="text-neutral-400 text-xs whitespace-nowrap">{item.quantidade}x</span>
                          <span className="text-white text-xs font-bold whitespace-nowrap">
                            {formatCurrency(item.valorUnitario)}
                          </span>
                          <button type="button" onClick={() => removeItem(item.id)} className="text-neutral-500 hover:text-red-500 transition-colors p-1">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      
                      {/* Discount Section */}
                      {current.items.length > 0 && calculateItemsTotal(current.items) > 0 && (
                        <div className="bg-[#111] border border-[#333] rounded-md p-4 mt-3 space-y-3">
                          <label className="flex items-center gap-2 text-[10px] font-black text-[#B5FF03] uppercase tracking-widest">
                            <Percent size={12} /> Desconto
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] rounded-md p-1">
                              <button
                                type="button"
                                onClick={() => { setDiscountType('percent'); setDiscountValue(0); }}
                                className={`px-3 py-1.5 text-[10px] font-black rounded transition-colors ${discountType === 'percent' ? 'bg-[#B5FF03] text-black' : 'text-neutral-400 hover:text-white'}`}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDiscountType('fixed'); setDiscountValue(0); }}
                                className={`px-3 py-1.5 text-[10px] font-black rounded transition-colors ${discountType === 'fixed' ? 'bg-[#B5FF03] text-black' : 'text-neutral-400 hover:text-white'}`}
                              >
                                R$
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={discountType === 'percent' ? 100 : undefined}
                              value={discountValue}
                              onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                              className="w-20 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-[#B5FF03]"
                              placeholder="0"
                            />
                            <span className="text-[10px] text-neutral-500 font-bold">
                              {discountType === 'percent' ? '%' : 'R$'}
                            </span>
                          </div>

                          {/* Discount preview */}
                          {(() => {
                            const { total, discountedTotal, discountAmount } = calculateDiscount(current.items || [], discountType, discountValue);
                            return (
                              <div className="space-y-1 pt-2 border-t border-[#333]">
                                <div className="flex justify-between text-xs text-neutral-400">
                                  <span>Total Bruto:</span>
                                  <span className="text-white font-bold">{formatCurrency(total)}</span>
                                </div>
                                {discountAmount > 0 && (
                                  <div className="flex justify-between text-xs text-red-400">
                                    <span>Desconto:</span>
                                    <span>-{formatCurrency(discountAmount)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-black text-[#B5FF03] border-t border-[#333] pt-1 mt-1">
                                  <span>Valor Final:</span>
                                  <span>{formatCurrency(discountedTotal)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 relative" ref={invDropdownRef}>
                    <div className="flex-1 relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        value={invSearch}
                        onChange={e => {
                          setInvSearch(e.target.value);
                          setNewItemDesc(e.target.value);
                          setShowInvDropdown(true);
                        }}
                        onFocus={() => setShowInvDropdown(true)}
                        placeholder="Buscar produto no estoque..."
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-md py-2 pl-8 pr-3 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#B5FF03] transition-colors"
                      />
                      {showInvDropdown && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#1a1a1a] border border-[#333] rounded-md shadow-xl max-h-48 overflow-y-auto">
                          {filteredInvItems.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-neutral-500 text-center">Nenhum produto encontrado no estoque</p>
                          ) : (
                            filteredInvItems.map(item => {
                              const available = getAvailableQuantity(item.name, current.firstContact || '');
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => handleItemSelect(item.name)}
                                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333] transition-colors border-b border-[#222] last:border-b-0 flex items-center justify-between"
                                >
                                  <span className="font-medium truncate mr-2">{item.name}</span>
                                  <span className={`whitespace-nowrap shrink-0 ${available > 0 ? 'text-neutral-400' : 'text-red-500'}`}>
                                    Disp: {available}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={newItemQty}
                      onChange={e => {
                        const qty = parseInt(e.target.value) || 1;
                        setNewItemQty(qty);
                        if (newItemDesc.trim()) {
                          const available = getAvailableQuantity(newItemDesc.trim(), current.firstContact || '');
                          if (qty > available && available > 0) {
                            alert(`Estoque insuficiente! Disponível apenas: ${available}`);
                          }
                        }
                      }}
                      className="w-14 bg-[#1a1a1a] border border-gray-700 rounded-md py-2 px-2 text-white text-xs text-center focus:outline-none focus:border-[#B5FF03] transition-colors"
                      placeholder="Qtd"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItemVal}
                      onChange={e => setNewItemVal(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-[#1a1a1a] border border-gray-700 rounded-md py-2 px-2 text-white text-xs text-right focus:outline-none focus:border-[#B5FF03] transition-colors"
                      placeholder="Valor unit."
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      className="p-2 bg-[#B5FF03] text-black rounded-md hover:bg-[#a1e600] transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:gap-3 px-4 md:px-7 py-3 md:py-5 border-t border-[#333] shrink-0 bg-[#111]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 md:py-3 rounded-md bg-[#222] text-white font-semibold hover:bg-[#333] transition-colors text-xs md:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-black text-white px-4 py-2 md:py-3 rounded-md font-bold hover:bg-neutral-800 active:scale-[0.98] transition-all text-xs md:text-sm"
                >
                  <Save size={15} strokeWidth={2.5} />
                  {mode === 'add' ? 'CADASTRAR CLIENTE E AGENDAR' : 'SALVAR ALTERAÇÕES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {whatsAppTarget && (
      <WhatsAppModal
        isOpen={!!whatsAppTarget}
        onClose={() => setWhatsAppTarget(null)}
        leadName={whatsAppTarget.name}
        leadWhatsapp={whatsAppTarget.whatsapp}
        leadEvent={whatsAppTarget.niche}
        leadEventDate={whatsAppTarget.firstContact}
        leadValue={whatsAppTarget.value}
        onEditLead={() => {
          const lead = whatsAppTarget;
          setWhatsAppTarget(null);
          openEdit(lead);
        }}
      />
    )}
    </>
  );
};

export default function OrçamentosPage() {
  return <CRMOrçamentos />;
}