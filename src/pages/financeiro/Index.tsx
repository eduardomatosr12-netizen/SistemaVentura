import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCRM, type CalendarEvent } from '../../contexts/CRMContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { generateUUID } from '../../lib/uuid';
import { parseMonetaryValue } from '../../lib/crmHelpers';
import { Pencil, X, TrendingUp, TrendingDown, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, SlidersHorizontal, Trash2 } from 'lucide-react';

interface Invoice {
  id: string;
  client: string;
  amount: string;
  date: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'evento' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  lastModifiedBy?: string;
  eventType?: string;
  city?: string;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  status: 'Pago' | 'Pendente' | 'Cancelado';
  paymentMethod?: string;
  expenseType?: 'fixa' | 'variavel';
  recurrence?: 'mensal' | 'trimestral' | 'anual';
  dueDay?: number;
  parentId?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'software', label: 'Software' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'salarios', label: 'Salários' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'luz', label: 'Luz' },
  { value: 'internet', label: 'Internet' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'material', label: 'Material de Escritório' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outros', label: 'Outros' },
];

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'parcelado', label: 'Parcelado' },
];

const RECURRENCE_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
];

const paymentMethodLabel = (value?: string, installments?: string) => {
  if (value === 'parcelado' && installments) return `Parcelado ${installments}x`;
  return PAYMENT_METHODS.find(pm => pm.value === value)?.label || value || '—';
};

const INVOICE_STATUSES = ['Pago', 'Pendente', 'Vencida', 'Cancelado'];
const EXPENSE_STATUSES = ['Pago', 'Pendente', 'Cancelado'];

const FilterSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#222222] pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between w-full text-left py-1"
      >
        <span className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest pl-1">{title}</span>
        {isOpen ? <ChevronUp size={14} className="text-[#aaaaaa]" /> : <ChevronDown size={14} className="text-[#aaaaaa]" />}
      </button>
      {isOpen && <div className="mt-3 space-y-2.5 pl-1">{children}</div>}
    </div>
  );
};

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1">
    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${checked ? 'bg-[#B5FF03] border-[#B5FF03]' : 'border-[#222222] group-hover:border-[#B5FF03]'}`}>
      {checked && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#aaaaaa]'}`}>{label}</span>
  </label>
);

const RadioFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1">
    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${checked ? 'bg-[#B5FF03] border-[#B5FF03]' : 'border-[#222222] group-hover:border-[#B5FF03]'}`}>
      {checked && <div className="w-2 h-2 bg-black rounded-full" />}
    </div>
    <input type="radio" className="hidden" checked={checked} onChange={onChange} />
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#aaaaaa]'}`}>{label}</span>
  </label>
);

const Financeiro = () => {
  const { Orçamentos, events, updateEvent } = useCRM();
  const { role, employeeName } = useAuth();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();

  const [viewMode, setViewMode] = useState<'receitas' | 'despesas'>('receitas');
  const [activeTab, setActiveTab] = useState<'receitas' | 'fixas' | 'variaveis' | 'despesas' | 'fluxo' | 'projecao'>('receitas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const initialFilterState = {
    period: '' as '' | 'today' | 'this_week' | 'this_month' | 'last_month' | '90_days' | 'this_year' | 'custom',
    customDateStart: '',
    customDateEnd: '',
    statuses: [] as string[],
    categories: [] as string[],
    origins: [] as string[],
    minValue: '',
    maxValue: '',
  };

  const [filtersReceitas, setFiltersReceitas] = useState({ ...initialFilterState });
  const [filtersDespesas, setFiltersDespesas] = useState({ ...initialFilterState });

  const activeFilters = viewMode === 'receitas' ? filtersReceitas : filtersDespesas;

  const parseBRL = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(clean) || 0;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };
    
  const getDateRange = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (activeFilters.period === 'today') {
      return { start: today, end: today };
    } else if (activeFilters.period === 'this_week') {
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      const end = new Date(today);
      end.setDate(start.getDate() + 6);
      return { start, end };
    } else if (activeFilters.period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    } else if (activeFilters.period === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    } else if (activeFilters.period === '90_days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: today };
    } else if (activeFilters.period === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    } else if (activeFilters.period === 'custom' && activeFilters.customDateStart && activeFilters.customDateEnd) {
      return { 
        start: new Date(activeFilters.customDateStart), 
        end: new Date(activeFilters.customDateEnd) 
      };
    }
    return null;
  }, [activeFilters]);

  const isInDateRange = useCallback((dateStr: string) => {
    if (!dateStr || dateStr === '—') return true;
    const range = getDateRange();
    if (!range) return true;
    const date = new Date(dateStr);
    return date >= range.start && date <= range.end;
  }, [getDateRange]);
    
  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    (events || []).forEach(e => { if (e.id) map.set(e.id, e); });
    return map;
  }, [events]);

  const eventsByClientId = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    (events || []).forEach(e => { if (e.clientId) map.set(e.clientId, e); });
    return map;
  }, [events]);

  const firebaseInvoices: Invoice[] = useMemo(() =>
    (transactions || [])
      .filter(t => t.type === 'receita' && t.source !== 'lead')
      .map(t => {
        const event = t.origemEventoId ? eventsById.get(t.origemEventoId) : undefined;
        return {
          id: t.id!,
          client: t.client || '',
          amount: formatCurrency(t.amount),
          date: t.date,
          status: t.status,
          source: (t.source as Invoice['source']) || 'manual',
          paymentMethod: t.paymentMethod,
          installments: t.installments,
          lastModifiedBy: t.lastModifiedBy,
          eventType: event?.eventType,
          city: event?.city,
        };
      }),
  [transactions, eventsById]);

  const [asaasInvoices] = useState<Invoice[]>([]);
    
  const computedLeadInvoices: Invoice[] = (Orçamentos || [])
    .filter(l => l.stage === 'Contrato Fechado')
    .map(l => {
      const event = eventsByClientId.get(l.id);
      return {
        id: `lead-${l.id}`,
        client: l.name,
        amount: l.value || 'R$ 0,00',
        date: l.closingDate || '—',
        status: 'Pago',
        source: 'lead',
        paymentMethod: 'pix',
        eventType: event?.eventType,
        city: event?.city,
      };
    });
    
  const allInvoices = useMemo(() => 
    [...asaasInvoices, ...firebaseInvoices, ...computedLeadInvoices].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [asaasInvoices, firebaseInvoices, computedLeadInvoices]);

  const filteredInvoices = useMemo(() => {
    let result = allInvoices || [];
      
    if (activeFilters.statuses?.length > 0) {
      const selectedLower = activeFilters.statuses.map(s => s.toLowerCase());
      result = result.filter(inv => selectedLower.includes(inv.status.toLowerCase()));
    }
      
    if (activeFilters.origins?.length > 0) {
      result = result.filter(inv => {
        const method = inv.paymentMethod || '';
        return activeFilters.origins.includes(method);
      });
    }
      
    result = result.filter(inv => isInDateRange(inv.date));
      
    if (activeFilters.minValue) {
      const min = parseFloat(activeFilters.minValue);
      result = result.filter(inv => parseBRL(inv.amount) >= min);
    }
    if (activeFilters.maxValue) {
      const max = parseFloat(activeFilters.maxValue);
      result = result.filter(inv => parseBRL(inv.amount) <= max);
    }
      
    return result;
  }, [allInvoices, activeFilters, isInDateRange]);

  const firebaseExpenses: Expense[] = useMemo(() =>
    (transactions || [])
      .filter(t => t.type === 'despesa')
      .map(t => ({
        id: t.id!,
        category: t.category || 'outros',
        description: t.description,
        amount: formatCurrency(t.amount),
        date: t.date,
        status: t.status as Expense['status'],
        paymentMethod: t.paymentMethod,
        expenseType: (t.expenseType as Expense['expenseType']) || 'variavel',
        recurrence: t.recurrence as Expense['recurrence'],
        dueDay: t.dueDay,
        parentId: t.parentId,
        origemEventoId: t.origemEventoId,
        lastModifiedBy: t.lastModifiedBy,
      })),
  [transactions]);
    
  const filteredExpenses = useMemo(() => {
    let result = firebaseExpenses || [];

    if (viewMode === 'despesas' && (activeTab === 'fixas' || activeTab === 'variaveis')) {
      result = result.filter(exp => exp.expenseType === activeTab.slice(0, -1));
    }
      
    if (activeFilters.categories?.length > 0) {
      result = result.filter(exp => activeFilters.categories.includes(exp.category));
    }
      
    if (activeFilters.statuses?.length > 0) {
      const selectedLower = activeFilters.statuses.map(s => s.toLowerCase());
      result = result.filter(exp => selectedLower.includes(exp.status.toLowerCase()));
    }
      
    result = result.filter(exp => isInDateRange(exp.date));
      
    if (activeFilters.minValue) {
      const min = parseFloat(activeFilters.minValue);
      result = result.filter(exp => parseBRL(exp.amount) >= min);
    }
    if (activeFilters.maxValue) {
      const max = parseFloat(activeFilters.maxValue);
      result = result.filter(exp => parseBRL(exp.amount) <= max);
    }
      
    return result;
  }, [firebaseExpenses, activeFilters, viewMode, activeTab, isInDateRange]);
    
  const isPaid = (s: string) => s.toLowerCase() === 'pago';
  const isCancelled = (s: string) => s.toLowerCase() === 'cancelado';
  const isPending = (s: string) => s.toLowerCase() === 'pendente';

  const cardsData = useMemo(() => {
    if (viewMode === 'receitas') {
      const base = firebaseInvoices;
      return {
        card1: {
          label: 'Total Recebido',
          icon: TrendingUp,
          iconColor: 'text-[#B5FF03]',
          value: base.filter(inv => isPaid(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
          dimmed: false,
        },
        card2: {
          label: 'Receitas Pendentes',
          icon: Clock,
          iconColor: 'text-[#aaaaaa]',
          value: base.filter(inv => isPending(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
          dimmed: false,
        },
      };
    }

    const fixas = firebaseExpenses.filter(exp => exp.expenseType === 'fixa');
    const variaveis = firebaseExpenses.filter(exp => exp.expenseType === 'variavel');
    const isFixasTab = activeTab === 'fixas';
    const isVariaveisTab = activeTab === 'variaveis';

    return {
      card1: {
        label: 'Fixas Pagas',
        icon: TrendingDown,
        iconColor: 'text-[#22c55e]',
        value: fixas.filter(exp => isPaid(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
        dimmed: isVariaveisTab,
      },
      card2: {
        label: 'Fixas Pendentes',
        icon: Clock,
        iconColor: 'text-[#aaaaaa]',
        value: fixas.filter(exp => isPending(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
        dimmed: isVariaveisTab,
      },
      card3: {
        label: 'Variáveis Pagas',
        icon: TrendingDown,
        iconColor: 'text-[#f97316]',
        value: variaveis.filter(exp => isPaid(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
        dimmed: isFixasTab,
      },
      card4: {
        label: 'Variáveis Pendentes',
        icon: AlertTriangle,
        iconColor: 'text-[#f97316]',
        value: variaveis.filter(exp => isPending(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
        dimmed: isFixasTab,
      },
    };
  }, [viewMode, firebaseInvoices, firebaseExpenses, activeTab]);

  /* Cash flow card data for sub-tabs */
  const fluxoData = useMemo(() => {
    return {
      entradaRealizada: filteredInvoices.filter(inv => isPaid(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
      entradaPendente: filteredInvoices.filter(inv => !isPaid(inv.status) && !isCancelled(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
      saidaRealizada: filteredExpenses.filter(exp => isPaid(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
      saidaPendente: filteredExpenses.filter(exp => isPending(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
    };
  }, [filteredInvoices, filteredExpenses]);

  const hasActiveFilters = activeFilters.period !== '' || activeFilters.statuses.length > 0 || 
    activeFilters.categories.length > 0 || activeFilters.origins.length > 0 || 
    activeFilters.minValue !== '' || activeFilters.maxValue !== '';

  const clearFilters = () => {
    const cleared = { ...initialFilterState };
    if (viewMode === 'receitas') setFiltersReceitas(cleared);
    else setFiltersDespesas(cleared);
  };

  useEffect(() => {
    if (!events || !transactions) return;
    const eventTransactions = new Set(
      transactions.filter(t => t.origemEventoId).map(t => t.origemEventoId)
    );
    const eventosSemFatura = events.filter(
      e => e.status === 'realizado' && e.id && !eventTransactions.has(e.id)
    );
    for (const event of eventosSemFatura) {
      const lead = Orçamentos.find(o => o.id === event.clientId);
      const valorOrcamento = lead ? parseMonetaryValue(lead.value) : Number(event.valorTotal ?? 0);
      if (!valorOrcamento) continue;
      addTransaction({
        client: event.client || '',
        description: `Evento: ${event.title} - ${event.client}`,
        amount: Number(valorOrcamento),
        date: event.date,
        status: 'Pendente',
        type: 'receita',
        source: 'evento',
        origemEventoId: event.id,
      }).catch(err => console.error('[Finance] Erro ao criar receita de evento:', err));
    }
  }, [events, transactions, Orçamentos, addTransaction]);
    
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isNewInvoice, setIsNewInvoice] = useState(false);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isNewExpense, setIsNewExpense] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState<{ expense: Expense; show: boolean }>({ expense: null as unknown as Expense, show: false });
    
  const handleOpenInvoiceModal = (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setIsNewInvoice(false);
    } else {
      setEditingInvoice({
        id: generateUUID(),
        client: '',
        amount: '0,00',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        source: 'manual'
      });
      setIsNewInvoice(true);
    }
    setIsInvoiceModalOpen(true);
  };
    
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    const amountValue = parseBRL(editingInvoice.amount);
      
    if (isNewInvoice) {
      try {
        await addTransaction({
          type: 'receita',
          client: editingInvoice.client,
          description: `Fatura: ${editingInvoice.client}`,
          amount: amountValue,
          date: editingInvoice.date,
          status: editingInvoice.status,
          source: 'manual',
          paymentMethod: editingInvoice.paymentMethod || 'pix',
          installments: editingInvoice.installments,
          lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
        });
      } catch (err) {
        console.error('[Finance] Erro ao salvar fatura:', err);
      }
    } else {
      const fbRecord = transactions.find(t => t.id === editingInvoice.id);
      if (fbRecord) {
        try {
          await updateTransaction(editingInvoice.id, {
            client: editingInvoice.client,
            amount: amountValue,
            date: editingInvoice.date,
            status: editingInvoice.status,
            paymentMethod: editingInvoice.paymentMethod,
            installments: editingInvoice.installments,
            lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
          });
        } catch (err) {
          console.error('[Finance] Erro ao atualizar fatura:', err);
        }
      }
    }
    setIsInvoiceModalOpen(false);
  };
    
  const handleDeleteInvoice = async (id: string) => {
    const inv = allInvoices.find(i => i.id === id);
    if (inv?.source === 'lead') {
      alert('Faturas de leads não podem ser excluídas manualmente.');
      return;
    }
    const msg = inv?.source === 'evento'
      ? 'Esta fatura está vinculada a um evento. Deseja mesmo excluí-la?'
      : 'Excluir esta fatura?';
    if (!confirm(msg)) return;
    try {
      if (inv?.source === 'evento') {
        const fbRecord = transactions.find(t => t.id === id);
        if (fbRecord?.origemEventoId) {
          updateEvent(fbRecord.origemEventoId, { status: 'pendente' }).catch(err =>
            console.error('[Finance] Erro ao reabrir evento:', err)
          );
        }
      }
      await deleteTransaction(id);
    } catch (err) {
      console.error('[Finance] Erro ao excluir fatura:', err);
    }
    setIsInvoiceModalOpen(false);
  };
    
  const handleOpenExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setIsNewExpense(false);
    } else {
      setEditingExpense({
        id: generateUUID(),
        category: 'outros',
        description: '',
        amount: '0,00',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        expenseType: 'variavel',
      });
      setIsNewExpense(true);
    }
    setIsExpenseModalOpen(true);
  };

  const getNextRecurrenceDates = (startDate: string, recurrence: 'mensal' | 'trimestral' | 'anual', dueDay?: number): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const count = recurrence === 'mensal' ? 12 : recurrence === 'trimestral' ? 4 : 1;
    for (let i = 0; i < count; i++) {
      const next = new Date(start);
      if (recurrence === 'mensal') next.setMonth(next.getMonth() + i);
      else if (recurrence === 'trimestral') next.setMonth(next.getMonth() + i * 3);
      else next.setFullYear(next.getFullYear() + i);
      if (dueDay) {
        next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      dates.push(next.toISOString().split('T')[0]);
    }
    return dates;
  };
    
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    const amountValue = parseBRL(editingExpense.amount);
    const isFixa = editingExpense.expenseType === 'fixa';
      
    if (isNewExpense) {
      try {
        if (isFixa && editingExpense.recurrence) {
          const parentId = generateUUID();
          const dates = getNextRecurrenceDates(editingExpense.date, editingExpense.recurrence, editingExpense.dueDay);
          for (const date of dates) {
            await addTransaction({
              type: 'despesa',
              description: editingExpense.description,
              category: editingExpense.category,
              amount: amountValue,
              date,
              status: 'Pendente',
              source: 'manual',
              paymentMethod: editingExpense.paymentMethod || 'pix',
              expenseType: 'fixa',
              recurrence: editingExpense.recurrence,
              dueDay: editingExpense.dueDay,
              parentId,
              lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
            });
          }
        } else {
          await addTransaction({
            type: 'despesa',
            description: editingExpense.description,
            category: editingExpense.category,
            amount: amountValue,
            date: editingExpense.date,
            status: editingExpense.status,
            source: 'manual',
            paymentMethod: editingExpense.paymentMethod || 'pix',
            expenseType: 'variavel',
            origemEventoId: editingExpense.origemEventoId,
            lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
          });
        }
      } catch (err) {
        console.error('[Finance] Erro ao salvar despesa:', err);
      }
    } else {
      try {
        await updateTransaction(editingExpense.id, {
          description: editingExpense.description,
          category: editingExpense.category,
          amount: amountValue,
          date: editingExpense.date,
          status: editingExpense.status,
          paymentMethod: editingExpense.paymentMethod,
          expenseType: editingExpense.expenseType,
          recurrence: isFixa ? editingExpense.recurrence : null,
          dueDay: isFixa ? editingExpense.dueDay : null,
          origemEventoId: editingExpense.origemEventoId,
          lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
        });
      } catch (err) {
        console.error('[Finance] Erro ao atualizar despesa:', err);
      }
    }
    setIsExpenseModalOpen(false);
  };

  const handleDeleteSingleExpense = async (id: string) => {
    try {
      await deleteTransaction(id);
    } catch (err) {
      console.error('[Finance] Erro ao excluir despesa:', err);
    }
    setIsExpenseModalOpen(false);
    setDeleteDialog({ expense: null as unknown as Expense, show: false });
  };

  const handleDeleteAllFutureExpenses = async (expense: Expense) => {
    const parentId = expense.parentId || expense.id;
    try {
      const related = transactions.filter(t =>
        t.parentId === parentId || t.id === parentId
      );
      for (const t of related) {
        await deleteTransaction(t.id!);
      }
    } catch (err) {
      console.error('[Finance] Erro ao excluir despesas recorrentes:', err);
    }
    setIsExpenseModalOpen(false);
    setDeleteDialog({ expense: null as unknown as Expense, show: false });
  };
    
  const handleDeleteExpense = async (expense: Expense) => {
    if (expense.expenseType === 'fixa') {
      setDeleteDialog({ expense, show: true });
    } else {
      if (confirm('Excluir esta despesa?')) {
        await handleDeleteSingleExpense(expense.id);
      }
    }
  };
    
  const statusStyle: Record<string, string> = {
    Pago: 'bg-[#111111] text-[#B5FF03] font-black uppercase tracking-widest border border-[#B5FF03]',
    Pendente: 'bg-[#111111] text-[#aaaaaa] font-black uppercase tracking-widest border border-[#222222]',
    Vencida: 'bg-[#111111] text-[#ff4444] font-black uppercase tracking-widest border border-[#ff4444]/50',
    Cancelado: 'bg-[#111111] text-[#aaaaaa] font-black uppercase tracking-widest border border-[#222222]',
  };

  const expenseTypeBadge = (type?: string) => {
    if (type === 'fixa') return 'bg-green-900 text-green-300 border border-green-700';
    return 'bg-amber-900 text-amber-300 border border-amber-700';
  };
    
  const categoryLabel = (cat: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  const handleFilterChange = (updater: (prev: typeof initialFilterState) => typeof initialFilterState) => {
    if (viewMode === 'receitas') {
      setFiltersReceitas(updater);
    } else {
      setFiltersDespesas(updater);
    }
  };
    
  const filterContent = (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#B5FF03]">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#aaaaaa] hover:text-[#B5FF03] transition-colors flex items-center gap-1"
          >
            <XCircle size={12} />
            Limpar
          </button>
        )}
      </div>

      <FilterSection title="Período">
        <RadioFilter
          label="Hoje"
          checked={activeFilters.period === 'today'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'today' ? '' : 'today' }))}
        />
        <RadioFilter
          label="Esta Semana"
          checked={activeFilters.period === 'this_week'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'this_week' ? '' : 'this_week' }))}
        />
        <RadioFilter
          label="Este Mês"
          checked={activeFilters.period === 'this_month'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'this_month' ? '' : 'this_month' }))}
        />
        <RadioFilter
          label="Mês Passado"
          checked={activeFilters.period === 'last_month'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'last_month' ? '' : 'last_month' }))}
        />
        <RadioFilter
          label="Últimos 90 Dias"
          checked={activeFilters.period === '90_days'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === '90_days' ? '' : '90_days' }))}
        />
        <RadioFilter
          label="Este Ano"
          checked={activeFilters.period === 'this_year'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'this_year' ? '' : 'this_year' }))}
        />
        <RadioFilter
          label="Personalizado"
          checked={activeFilters.period === 'custom'}
          onChange={() => handleFilterChange(prev => ({ ...prev, period: prev.period === 'custom' ? '' : 'custom' }))}
        />
        {activeFilters.period === 'custom' && (
          <div className="space-y-3 pt-2 pl-1">
            <div>
              <label className="text-xs text-[#aaaaaa] uppercase tracking-widest mb-1 block">De:</label>
              <input
                type="date"
                value={activeFilters.customDateStart}
                onChange={(e) => handleFilterChange(prev => ({ ...prev, customDateStart: e.target.value }))}
                className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#aaaaaa] uppercase tracking-widest mb-1 block">Até:</label>
              <input
                type="date"
                value={activeFilters.customDateEnd}
                onChange={(e) => handleFilterChange(prev => ({ ...prev, customDateEnd: e.target.value }))}
                className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
              />
            </div>
          </div>
        )}
      </FilterSection>

      <FilterSection title="Status">
        {(viewMode === 'receitas' ? INVOICE_STATUSES : EXPENSE_STATUSES).map(status => (
          <CheckboxFilter
            key={status}
            label={status}
            checked={activeFilters.statuses.includes(status)}
            onChange={(checked) => {
              if (checked) {
                handleFilterChange(prev => ({ ...prev, statuses: [...prev.statuses, status] }));
              } else {
                handleFilterChange(prev => ({ ...prev, statuses: prev.statuses.filter(s => s !== status) }));
              }
            }}
          />
        ))}
      </FilterSection>

      {viewMode === 'receitas' && (
        <FilterSection title="Forma de Pagamento">
          {PAYMENT_METHODS.map(pm => (
            <CheckboxFilter
              key={pm.value}
              label={pm.label}
              checked={activeFilters.origins.includes(pm.value)}
              onChange={(checked) => {
                if (checked) {
                  handleFilterChange(prev => ({ ...prev, origins: [...prev.origins, pm.value] }));
                } else {
                  handleFilterChange(prev => ({ ...prev, origins: prev.origins.filter(o => o !== pm.value) }));
                }
              }}
            />
          ))}
        </FilterSection>
      )}

      {viewMode === 'despesas' && (
        <FilterSection title="Categorias">
          {EXPENSE_CATEGORIES.map(cat => (
            <CheckboxFilter
              key={cat.value}
              label={cat.label}
              checked={activeFilters.categories.includes(cat.value)}
              onChange={(checked) => {
                if (checked) {
                  handleFilterChange(prev => ({ ...prev, categories: [...prev.categories, cat.value] }));
                } else {
                  handleFilterChange(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat.value) }));
                }
              }}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title="Valor">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#aaaaaa] uppercase tracking-widest">Mínimo (R$)</label>
            <input
              type="number"
              value={activeFilters.minValue}
              onChange={(e) => handleFilterChange(prev => ({ ...prev, minValue: e.target.value }))}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#aaaaaa] uppercase tracking-widest">Máximo (R$)</label>
            <input
              type="number"
              value={activeFilters.maxValue}
              onChange={(e) => handleFilterChange(prev => ({ ...prev, maxValue: e.target.value }))}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
            />
          </div>
        </div>
      </FilterSection>
    </>
  );

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      {/* Header */}
      <div className="p-6 border-b border-[#222222]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-black uppercase tracking-widest text-white">Financeiro</h1>
          <div className="flex flex-wrap gap-3">
            {viewMode === 'receitas' ? (
              <button
                onClick={() => handleOpenInvoiceModal()}
                className="rounded-full px-3 py-1.5 min-w-[120px] bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a5ef03] transition-colors"
              >
                CRIAR FATURA
              </button>
            ) : (
              <button
                onClick={() => handleOpenExpenseModal()}
                className="rounded-full px-3 py-1.5 min-w-[120px] bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a5ef03] transition-colors"
              >
                CRIAR DESPESA
              </button>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-full px-3 py-1.5 min-w-[120px] bg-[#111111] text-white font-bold text-xs uppercase tracking-widest border border-[#222222] hover:border-[#B5FF03] transition-colors flex items-center justify-center gap-2"
            >
              <SlidersHorizontal size={14} />
              FILTROS
            </button>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex gap-3">
          <button
            onClick={() => { setViewMode('receitas'); setActiveTab('receitas'); }}
            className={`rounded-full px-5 py-2 font-bold text-xs uppercase tracking-widest transition-colors ${
              viewMode === 'receitas'
                ? 'bg-[#B5FF03] text-black'
                : 'bg-[#111111] text-white border border-[#222222] hover:border-[#B5FF03]'
            }`}
          >
            RECEITAS
          </button>
          <button
            onClick={() => { setViewMode('despesas'); setActiveTab('fixas'); }}
            className={`rounded-full px-5 py-2 font-bold text-xs uppercase tracking-widest transition-colors ${
              viewMode === 'despesas'
                ? 'bg-[#B5FF03] text-black'
                : 'bg-[#111111] text-white border border-[#222222] hover:border-[#B5FF03]'
            }`}
          >
            DESPESAS
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`p-6 grid grid-cols-1 gap-4 ${viewMode === 'receitas' ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
        {Object.values(cardsData).map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`bg-[#111111] border rounded-lg p-4 transition-opacity ${
                card.dimmed ? 'border-[#222222] opacity-40' : 'border-[#222222]'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">{card.label}</span>
                <Icon size={16} className={card.iconColor} />
              </div>
              <p className="text-2xl font-black text-white">{formatCurrency(card.value)}</p>
            </div>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="px-6 border-b border-[#222222]">
        {viewMode === 'receitas' ? (
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('receitas')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'receitas'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Receitas ({filteredInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fluxo'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Fluxo de Caixa ({filteredExpenses.length + filteredInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('projecao')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'projecao'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Projeção (Parcelas)
            </button>
          </div>
        ) : (
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('fixas')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fixas'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Fixas ({firebaseExpenses.filter(e => e.expenseType === 'fixa').length})
            </button>
            <button
              onClick={() => setActiveTab('variaveis')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'variaveis'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Variáveis ({firebaseExpenses.filter(e => e.expenseType === 'variavel').length})
            </button>
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fluxo'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Fluxo de Saídas ({filteredExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('projecao')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'projecao'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Projeção (Parcelas)
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex relative">
        <div className="flex-1 p-6">
          {/* Receitas View - RECEITAS tab */}
          {viewMode === 'receitas' && activeTab === 'receitas' && (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Tipo de Evento</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cliente</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Pagamento</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cidade</th>
                    <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-[#aaaaaa]">{invoice.eventType || '—'}</td>
                      <td className="p-4 text-sm text-white">{invoice.client}</td>
                      <td className="p-4 text-sm text-white">{invoice.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{invoice.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{paymentMethodLabel(invoice.paymentMethod, invoice.installments)}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{invoice.city || '—'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenInvoiceModal(invoice)}
                          className="text-[#B5FF03] hover:text-white transition-colors mr-3 cursor-pointer"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-[#aaaaaa]">
                        Nenhuma fatura encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filteredInvoices.map(invoice => (
                <div key={invoice.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{invoice.client}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusStyle[invoice.status]}`}>{invoice.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">Tipo:</span> <span className="text-white">{invoice.eventType || '—'}</span></div>
                    <div><span className="text-neutral-500">Valor:</span> <span className="text-white">{invoice.amount}</span></div>
                    <div><span className="text-neutral-500">Data:</span> <span className="text-white">{invoice.date}</span></div>
                    <div><span className="text-neutral-500">Cidade:</span> <span className="text-white">{invoice.city || '—'}</span></div>
                    <div><span className="text-neutral-500">Pagamento:</span> <span className="text-white">{paymentMethodLabel(invoice.paymentMethod, invoice.installments)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => handleOpenInvoiceModal(invoice)} className="text-[#B5FF03] p-2 min-h-[44px]"><Pencil size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredInvoices.length === 0 && (
                <p className="text-center text-sm text-[#aaaaaa] py-8">Nenhuma fatura encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Receitas View - FLUXO DE CAIXA tab */}
          {viewMode === 'receitas' && activeTab === 'fluxo' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Entradas Realizadas</span>
                  <TrendingUp size={16} className="text-[#B5FF03]" />
                </div>
                <p className="text-2xl font-black text-[#B5FF03]">{formatCurrency(fluxoData.entradaRealizada)}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Entradas Pendentes</span>
                  <Clock size={16} className="text-[#aaaaaa]" />
                </div>
                <p className="text-2xl font-black text-white">{formatCurrency(fluxoData.entradaPendente)}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Saídas Realizadas</span>
                  <TrendingDown size={16} className="text-[#ff4444]" />
                </div>
                <p className="text-2xl font-black text-[#ff4444]">{formatCurrency(fluxoData.saidaRealizada)}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Saídas Pendentes</span>
                  <AlertTriangle size={16} className="text-[#ff4444]" />
                </div>
                <p className="text-2xl font-black text-[#ff4444]">{formatCurrency(fluxoData.saidaPendente)}</p>
              </div>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Tipo</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Descrição</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredInvoices, ...filteredExpenses]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(item => {
                      const isInvoice = 'client' in item;
                      return (
                        <tr key={item.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                          <td className="p-4 text-sm">
                            <span className={isInvoice ? 'text-[#B5FF03]' : 'text-[#ff4444]'}>
                              {isInvoice ? 'Receita' : 'Despesa'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-white">{isInvoice ? (item as Invoice).client : (item as Expense).description}</td>
                          <td className="p-4 text-sm text-white">{item.amount}</td>
                          <td className="p-4 text-sm text-[#aaaaaa]">{item.date}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[item.status]}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {filteredInvoices.length === 0 && filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-[#aaaaaa]">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Receitas View - PROJEÇÃO tab */}
          {viewMode === 'receitas' && activeTab === 'projecao' && (
            <>
            <div className="mb-4">
              <h2 className="text-lg font-black text-white mb-1">Projeção de Receitas</h2>
              <p className="text-xs text-neutral-400">Faturamento futuro projetado com base em contratos parcelados.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(() => {
                const projectedInvoices = allInvoices.filter(inv => inv.paymentMethod === 'parcelado' && inv.status !== 'Cancelado');
                const projectionByMonth: Record<string, number> = {};
                projectedInvoices.forEach(inv => {
                  if (!inv.date || inv.date === '—') return;
                  const monthKey = inv.date.substring(0, 7);
                  projectionByMonth[monthKey] = (projectionByMonth[monthKey] || 0) + parseBRL(inv.amount);
                });
                const sortedMonths = Object.entries(projectionByMonth).sort(([a], [b]) => a.localeCompare(b));
                return sortedMonths.slice(0, 12).map(([month, total]) => {
                  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const [y, m] = month.split('-');
                  return (
                    <div key={month} className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                      <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">
                        {monthNames[parseInt(m) - 1]} {y}
                      </div>
                      <div className="text-lg font-black text-[#B5FF03]">{formatCurrency(total)}</div>
                      <div className="text-[10px] text-neutral-500">{projectedInvoices.filter(inv => inv.date?.startsWith(month)).length} parcela(s)</div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cliente</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data Prevista</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Parcela</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.filter(inv => inv.paymentMethod === 'parcelado').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(inv => (
                    <tr key={inv.id} className="border-b border-[#222222] hover:bg-[#1a1a1a]">
                      <td className="p-4 text-sm text-white">{inv.client}</td>
                      <td className="p-4 text-sm text-white">{inv.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{inv.date}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{inv.installments ? `${inv.installments}x` : '—'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[inv.status] || statusStyle.Pendente}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {allInvoices.filter(inv => inv.paymentMethod === 'parcelado').length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-sm text-[#aaaaaa]">Nenhuma projeção disponível.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Despesas View - FIXAS tab */}
          {viewMode === 'despesas' && activeTab === 'fixas' && (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Descrição</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Tipo</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Categoria</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data de Vencimento</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Forma de Pagamento</th>
                    <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-white">{expense.description}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expenseTypeBadge(expense.expenseType)}`}>
                          {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{categoryLabel(expense.category)}</td>
                      <td className="p-4 text-sm text-white">{expense.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{expense.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{paymentMethodLabel(expense.paymentMethod)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenExpenseModal(expense)}
                          className="text-[#B5FF03] hover:text-white transition-colors mr-3"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          className="text-[#ff4444] hover:text-white transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-[#aaaaaa]">
                        Nenhuma despesa fixa encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filteredExpenses.map(expense => (
                <div key={expense.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{expense.description}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expenseTypeBadge(expense.expenseType)}`}>
                        {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusStyle[expense.status]}`}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">Categoria:</span> <span className="text-white">{categoryLabel(expense.category)}</span></div>
                    <div><span className="text-neutral-500">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-neutral-500">Data:</span> <span className="text-white">{expense.date}</span></div>
                    <div><span className="text-neutral-500">Pagamento:</span> <span className="text-white">{paymentMethodLabel(expense.paymentMethod)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => handleOpenExpenseModal(expense)} className="text-[#B5FF03] p-2 min-h-[44px]"><Pencil size={18} /></button>
                    <button onClick={() => handleDeleteExpense(expense)} className="text-[#ff4444] p-2 min-h-[44px]"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#aaaaaa] py-8">Nenhuma despesa fixa encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - VARIÁVEIS tab */}
          {viewMode === 'despesas' && activeTab === 'variaveis' && (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Descrição</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Tipo</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Categoria</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data de Vencimento</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Forma de Pagamento</th>
                    <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-white">{expense.description}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expenseTypeBadge(expense.expenseType)}`}>
                          {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{categoryLabel(expense.category)}</td>
                      <td className="p-4 text-sm text-white">{expense.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{expense.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{paymentMethodLabel(expense.paymentMethod)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenExpenseModal(expense)}
                          className="text-[#B5FF03] hover:text-white transition-colors mr-3"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          className="text-[#ff4444] hover:text-white transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-[#aaaaaa]">
                        Nenhuma despesa variável encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filteredExpenses.map(expense => (
                <div key={expense.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{expense.description}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expenseTypeBadge(expense.expenseType)}`}>
                        {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusStyle[expense.status]}`}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">Categoria:</span> <span className="text-white">{categoryLabel(expense.category)}</span></div>
                    <div><span className="text-neutral-500">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-neutral-500">Data:</span> <span className="text-white">{expense.date}</span></div>
                    <div><span className="text-neutral-500">Pagamento:</span> <span className="text-white">{paymentMethodLabel(expense.paymentMethod)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => handleOpenExpenseModal(expense)} className="text-[#B5FF03] p-2 min-h-[44px]"><Pencil size={18} /></button>
                    <button onClick={() => handleDeleteExpense(expense)} className="text-[#ff4444] p-2 min-h-[44px]"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#aaaaaa] py-8">Nenhuma despesa variável encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - FLUXO DE SAÍDAS tab */}
          {viewMode === 'despesas' && activeTab === 'fluxo' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Total Pago</span>
                  <TrendingDown size={16} className="text-[#ff4444]" />
                </div>
                <p className="text-2xl font-black text-[#ff4444]">{formatCurrency(fluxoData.saidaRealizada)}</p>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Saídas Pendentes</span>
                  <AlertTriangle size={16} className="text-[#ff4444]" />
                </div>
                <p className="text-2xl font-black text-[#ff4444]">{formatCurrency(fluxoData.saidaPendente)}</p>
              </div>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Descrição</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Tipo</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Categoria</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-white">{expense.description}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${expenseTypeBadge(expense.expenseType)}`}>
                          {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{categoryLabel(expense.category)}</td>
                      <td className="p-4 text-sm text-white">{expense.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{expense.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[#aaaaaa]">
                        Nenhuma despesa encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Despesas View - PROJEÇÃO tab */}
          {viewMode === 'despesas' && activeTab === 'projecao' && (
            <>
            <div className="mb-4">
              <h2 className="text-lg font-black text-white mb-1">Projeção de Despesas</h2>
              <p className="text-xs text-neutral-400">Despesas futuras projetadas.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(() => {
                const projected = allInvoices.filter(inv => inv.paymentMethod === 'parcelado' && inv.status !== 'Cancelado');
                const projectionByMonth: Record<string, number> = {};
                projected.forEach(inv => {
                  if (!inv.date || inv.date === '—') return;
                  const monthKey = inv.date.substring(0, 7);
                  projectionByMonth[monthKey] = (projectionByMonth[monthKey] || 0) + parseBRL(inv.amount);
                });
                const sortedMonths = Object.entries(projectionByMonth).sort(([a], [b]) => a.localeCompare(b));
                return sortedMonths.slice(0, 12).map(([month, total]) => {
                  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const [y, m] = month.split('-');
                  return (
                    <div key={month} className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                      <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">
                        {monthNames[parseInt(m) - 1]} {y}
                      </div>
                      <div className="text-lg font-black text-[#ff4444]">{formatCurrency(total)}</div>
                      <div className="text-[10px] text-neutral-500">{projected.filter(inv => inv.date?.startsWith(month)).length} parcela(s)</div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cliente</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data Prevista</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Parcela</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.filter(inv => inv.paymentMethod === 'parcelado').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(inv => (
                    <tr key={inv.id} className="border-b border-[#222222] hover:bg-[#1a1a1a]">
                      <td className="p-4 text-sm text-white">{inv.client}</td>
                      <td className="p-4 text-sm text-white">{inv.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{inv.date}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{inv.installments ? `${inv.installments}x` : '—'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[inv.status] || statusStyle.Pendente}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {allInvoices.filter(inv => inv.paymentMethod === 'parcelado').length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-sm text-[#aaaaaa]">Nenhuma projeção disponível.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
        
        {/* Filter Sidebar */}
        {isSidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed inset-x-0 bottom-0 z-[100] bg-[#0a0a0a] border-t border-[#222] rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto md:hidden">
              {filterContent}
            </div>
            <div className="hidden md:block w-64 bg-[#0a0a0a] border-l border-[#222222] p-4 overflow-y-auto max-h-screen sticky top-0">
              {filterContent}
            </div>
          </>
        )}
      </div>

      {/* Delete Recurring Expense Dialog */}
      {deleteDialog.show && deleteDialog.expense && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-black uppercase tracking-widest text-white mb-4">Excluir Despesa Fixa</h3>
            <p className="text-sm text-[#aaaaaa] mb-6">Deseja excluir apenas este lançamento ou todos os futuros?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDialog({ expense: null as unknown as Expense, show: false })}
                className="rounded-full px-4 py-2 bg-[#111111] text-white font-bold text-xs uppercase tracking-widest border border-[#222222] hover:border-[#B5FF03] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSingleExpense(deleteDialog.expense.id)}
                className="rounded-full px-4 py-2 bg-[#111111] text-[#ff4444] font-bold text-xs uppercase tracking-widest border border-[#ff4444]/50 hover:border-[#ff4444] transition-colors"
              >
                Só Este
              </button>
              <button
                onClick={() => handleDeleteAllFutureExpenses(deleteDialog.expense)}
                className="rounded-full px-4 py-2 bg-[#ff4444] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#e03333] transition-colors"
              >
                Todos Futuros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && editingInvoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-full md:max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                {isNewInvoice ? 'Nova Fatura' : 'Editar Fatura'}
              </h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-[#aaaaaa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Cliente</label>
                <input
                  type="text"
                  value={editingInvoice.client}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, client: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Valor (R$)</label>
                <input
                  type="text"
                  value={editingInvoice.amount}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Data</label>
                <input
                  type="date"
                  value={editingInvoice.date}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Status</label>
                <select
                  value={editingInvoice.status}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value as Invoice['status'] })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  {INVOICE_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Forma de Pagamento</label>
                <select
                  value={editingInvoice.paymentMethod || ''}
                  onChange={(e) => setEditingInvoice({
                    ...editingInvoice,
                    paymentMethod: e.target.value,
                    installments: e.target.value !== 'parcelado' ? '' : editingInvoice.installments
                  })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  <option value="">Selecionar</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: editingInvoice.paymentMethod === 'parcelado' ? 'block' : 'none' }}>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Qtd. Parcelas</label>
                <select
                  value={editingInvoice.installments || '1'}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, installments: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={String(n)}>{n}x</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                {!isNewInvoice && (
                  <button
                    type="button"
                    onClick={() => handleDeleteInvoice(editingInvoice.id)}
                    className="rounded-full px-3 py-1.5 min-w-[120px] min-h-[44px] bg-[#111111] text-[#ff4444] font-bold text-xs uppercase tracking-widest border border-[#ff4444]/50 hover:border-[#ff4444] transition-colors"
                  >
                    EXCLUIR
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 min-w-[120px] min-h-[44px] bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a5ef03] transition-colors"
                  >
                    SALVAR
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && editingExpense && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-full md:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                {isNewExpense ? 'Nova Despesa' : 'Editar Despesa'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#aaaaaa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              {/* Tipo de Despesa */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-3">Tipo de Despesa</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${editingExpense.expenseType === 'fixa' ? 'bg-[#22c55e] border-[#22c55e]' : 'border-[#222222]'}`}>
                      {editingExpense.expenseType === 'fixa' && <div className="w-2 h-2 bg-black rounded-full" />}
                    </div>
                    <input
                      type="radio"
                      className="hidden"
                      checked={editingExpense.expenseType === 'fixa'}
                      onChange={() => setEditingExpense({ ...editingExpense, expenseType: 'fixa', recurrence: 'mensal', dueDay: 1 })}
                    />
                    <span className="text-xs font-bold text-white">Fixa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${editingExpense.expenseType === 'variavel' ? 'bg-[#f97316] border-[#f97316]' : 'border-[#222222]'}`}>
                      {editingExpense.expenseType === 'variavel' && <div className="w-2 h-2 bg-black rounded-full" />}
                    </div>
                    <input
                      type="radio"
                      className="hidden"
                      checked={editingExpense.expenseType === 'variavel'}
                      onChange={() => setEditingExpense({ ...editingExpense, expenseType: 'variavel', recurrence: undefined, dueDay: undefined })}
                    />
                    <span className="text-xs font-bold text-white">Variável</span>
                  </label>
                </div>
              </div>

              {/* FIXA: Recorrência */}
              {editingExpense.expenseType === 'fixa' && (
                <>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Recorrência</label>
                  <select
                    value={editingExpense.recurrence || 'mensal'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, recurrence: e.target.value as Expense['recurrence'] })}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  >
                    {RECURRENCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Dia de Vencimento</label>
                  <select
                    value={editingExpense.dueDay || 1}
                    onChange={(e) => setEditingExpense({ ...editingExpense, dueDay: Number(e.target.value) })}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}º</option>
                    ))}
                  </select>
                </div>
                </>
              )}

              {/* VARIÁVEL: Evento vinculado */}
              {editingExpense.expenseType === 'variavel' && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Evento Vinculado (opcional)</label>
                  <select
                    value={editingExpense.origemEventoId || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, origemEventoId: e.target.value || undefined })}
                    className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  >
                    <option value="">Nenhum</option>
                    {(events || []).filter(e => e.status !== 'cancelado').map(event => (
                      <option key={event.id} value={event.id}>{event.title} - {event.client || 'Sem cliente'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Categoria</label>
                <select
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Descrição</label>
                <input
                  type="text"
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Valor (R$)</label>
                <input
                  type="text"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">
                  {editingExpense.expenseType === 'fixa' ? 'Primeiro Vencimento' : 'Data de Vencimento'}
                </label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Forma de Pagamento</label>
                <select
                  value={editingExpense.paymentMethod || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  <option value="">Selecionar</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Status</label>
                <select
                  value={editingExpense.status}
                  onChange={(e) => setEditingExpense({ ...editingExpense, status: e.target.value as Expense['status'] })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                >
                  {EXPENSE_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                {!isNewExpense && (
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(editingExpense)}
                    className="rounded-full px-3 py-1.5 min-w-[120px] min-h-[44px] bg-[#111111] text-[#ff4444] font-bold text-xs uppercase tracking-widest border border-[#ff4444]/50 hover:border-[#ff4444] transition-colors"
                  >
                    EXCLUIR
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 min-w-[120px] min-h-[44px] bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a5ef03] transition-colors"
                  >
                    SALVAR
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financeiro;
