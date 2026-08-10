import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM, type CalendarEvent } from '../../contexts/CRMContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { generateUUID } from '../../lib/uuid';
import { parseMonetaryValue } from '../../lib/crmHelpers';
import { eventTypeLabel } from '../../lib/eventTypeLabel';
import { Pencil, X, TrendingUp, TrendingDown, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, SlidersHorizontal, Trash2, BarChart3 } from 'lucide-react';

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
  totalExpenses?: string;
  profit?: string;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Cancelado';
  paymentMethod?: string;
  installments?: string;
  expenseType?: 'fixa' | 'variavel';
  recurrence?: 'mensal' | 'trimestral' | 'anual';
  dueDay?: number;
  parentId?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
  eventType?: string;
  city?: string;
  client?: string;
  receivedAmount?: string;
  eventProfit?: string;
}

const FIXED_CATEGORIES = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'salarios', label: 'Salários' },
  { value: 'luz', label: 'Luz' },
  { value: 'agua', label: 'Água' },
  { value: 'internet', label: 'Internet' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'equipamentos', label: 'Equipamentos' },
];

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

const RECURRENCE_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
];

const paymentMethodLabel = (value?: string, installments?: string) => {
  if (value === 'parcelado' && installments) return `Parcelado ${installments}x`;
  if (value === 'credito' && installments) return `Cartão de Crédito ${installments}x`;
  return PAYMENT_METHODS.find(pm => pm.value === value)?.label || value || '—';
};

const INVOICE_STATUSES = ['Pago', 'Pendente', 'Vencida', 'Cancelado'];
const EXPENSE_STATUSES = ['Pago', 'Pendente', 'Cancelado'];

const FilterSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[rgba(255,255,255,0.08)] pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between w-full text-left py-1"
      >
        <span className="section-label">{title}</span>
        {isOpen ? <ChevronUp size={14} className="text-[#A0A0A0]" /> : <ChevronDown size={14} className="text-[#A0A0A0]" />}
      </button>
      {isOpen && <div className="mt-3 space-y-2.5 pl-1">{children}</div>}
    </div>
  );
};

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1 min-h-[36px]">
    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${checked ? 'bg-[#CCFF00] border-[#CCFF00]' : 'border-[rgba(255,255,255,0.2)] group-hover:border-[#CCFF00]'}`}>
      {checked && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#A0A0A0]'}`}>{label}</span>
  </label>
);

const RadioFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1 min-h-[36px]">
    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${checked ? 'bg-[#CCFF00] border-[#CCFF00]' : 'border-[rgba(255,255,255,0.2)] group-hover:border-[#CCFF00]'}`}>
      {checked && <div className="w-2 h-2 bg-black rounded-full" />}
    </div>
    <input type="radio" className="hidden" checked={checked} onChange={onChange} />
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#A0A0A0]'}`}>{label}</span>
  </label>
);

const Financeiro = () => {
  const { Orçamentos, events, updateEvent } = useCRM();
  const { role, employeeName } = useAuth();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const navigate = useNavigate();

  const [syncCounter, setSyncCounter] = useState(0);
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
    const clean = val.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(clean) || 0;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return dateStr;
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  const parseDateSafe = (dateStr: string): Date => {
    if (!dateStr) return new Date(NaN);
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
    return new Date(dateStr);
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
    const date = parseDateSafe(dateStr);
    return date >= range.start && date <= range.end;
  }, [getDateRange]);
    
  const isPaid = (s: string) => s.toLowerCase() === 'pago';
  const isCancelled = (s: string) => s.toLowerCase() === 'cancelado';
  const isPending = (s: string) => s.toLowerCase() === 'pendente';

  const rawReceitas = useMemo(
    () => (transactions || []).filter(t => t.type === 'receita' && t.source !== 'lead'),
    [transactions]
  );

  const rawDespesas = useMemo(
    () => (transactions || []).filter(t => t.type === 'despesa'),
    [transactions]
  );

  const totalRecebido = useMemo(() =>
    rawReceitas
      .filter(r => (r.status || '').toLowerCase() === 'pago')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [rawReceitas]
  );

  const receitasPendentes = useMemo(() =>
    rawReceitas
      .filter(r => (r.status || '').toLowerCase() === 'pendente')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [rawReceitas]
  );

  const fixasPagas = useMemo(() =>
    rawDespesas
      .filter(d => d.expenseType === 'fixa' && (d.status || '').toLowerCase() === 'pago')
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0),
    [rawDespesas]
  );

  const fixasPendentes = useMemo(() =>
    rawDespesas
      .filter(d => d.expenseType === 'fixa' && (d.status || '').toLowerCase() === 'pendente')
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0),
    [rawDespesas]
  );

  const variaveisPagas = useMemo(() =>
    rawDespesas
      .filter(d => (d.expenseType || 'variavel') === 'variavel' && (d.status || '').toLowerCase() === 'pago')
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0),
    [rawDespesas]
  );

  const variaveisPendentes = useMemo(() =>
    rawDespesas
      .filter(d => (d.expenseType || 'variavel') === 'variavel' && (d.status || '').toLowerCase() === 'pendente')
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0),
    [rawDespesas]
  );

  const isFixasTab = activeTab === 'fixas';
  const isVariaveisTab = activeTab === 'variaveis';

  const displayData = useMemo(() => {
    const eventsById = new Map<string, CalendarEvent>();
    (events || []).forEach(e => { if (e.id) eventsById.set(e.id, e); });
    const eventsByClientId = new Map<string, CalendarEvent>();
    (events || []).forEach(e => { if (e.clientId) eventsByClientId.set(e.clientId, e); });

    const expensesByEventId = new Map<string, number>();
    (transactions || [])
      .filter(t => t.type === 'despesa' && t.origemEventoId)
      .forEach(t => {
        const current = expensesByEventId.get(t.origemEventoId!) || 0;
        expensesByEventId.set(t.origemEventoId!, current + (t.amount || 0));
      });

    const revenueByEventId = new Map<string, number>();
    (transactions || [])
      .filter(t => t.type === 'receita' && t.origemEventoId)
      .forEach(t => {
        const current = revenueByEventId.get(t.origemEventoId!) || 0;
        revenueByEventId.set(t.origemEventoId!, current + (t.amount || 0));
      });

    const rawInvoices: Invoice[] = (transactions || [])
      .filter(t => t.type === 'receita' && t.source !== 'lead')
      .map(t => {
        const event = t.origemEventoId ? eventsById.get(t.origemEventoId) : undefined;
        const totalExpenses = t.origemEventoId ? (expensesByEventId.get(t.origemEventoId) || 0) : 0;
        const invoiceAmount = t.amount || 0;
        return {
          id: t.id!,
          client: t.client || '',
          amount: formatCurrency(invoiceAmount),
          date: formatDate(t.date),
          status: t.status,
          source: (t.source as Invoice['source']) || 'manual',
          paymentMethod: t.paymentMethod,
          installments: t.installments,
          lastModifiedBy: t.lastModifiedBy,
          eventType: event?.eventType,
          city: event?.city,
          totalExpenses: formatCurrency(totalExpenses),
          profit: formatCurrency(invoiceAmount - totalExpenses),
        };
      });

    const leadInvoices: Invoice[] = (Orçamentos || [])
      .filter(l => l.stage === 'Contrato Fechado')
      .map(l => {
        const event = eventsByClientId.get(l.id);
        return {
          id: `lead-${l.id}`,
          client: l.name,
          amount: l.value || 'R$ 0,00',
          date: formatDate(l.closingDate) || '—',
          status: 'Pago',
          source: 'lead',
          paymentMethod: 'pix',
          eventType: event?.eventType,
          city: event?.city,
          totalExpenses: '—',
          profit: '—',
        };
      });

    const allInvoices: Invoice[] = [...rawInvoices, ...leadInvoices].sort((a, b) =>
      parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime()
    );

    const filteredInvoices = allInvoices.filter(inv => {
      if (activeFilters.statuses?.length > 0) {
        const selectedLower = activeFilters.statuses.map(s => s.toLowerCase());
        if (!selectedLower.includes(inv.status.toLowerCase())) return false;
      }
      if (activeFilters.origins?.length > 0) {
        const method = inv.paymentMethod || '';
        if (!activeFilters.origins.includes(method)) return false;
      }
      if (!isInDateRange(inv.date)) return false;
      if (activeFilters.minValue) {
        const min = parseFloat(activeFilters.minValue);
        if (parseBRL(inv.amount) < min) return false;
      }
      if (activeFilters.maxValue) {
        const max = parseFloat(activeFilters.maxValue);
        if (parseBRL(inv.amount) > max) return false;
      }
      return true;
    });

    const allExpenses: Expense[] = (transactions || [])
      .filter(t => t.type === 'despesa')
      .map(t => {
        const event = t.origemEventoId ? eventsById.get(t.origemEventoId) : undefined;
        const eventRevenue = t.origemEventoId ? (revenueByEventId.get(t.origemEventoId) || 0) : 0;
        const expenseAmount = t.amount || 0;
        const totalEventExpenses = t.origemEventoId ? (expensesByEventId.get(t.origemEventoId) || 0) : 0;
        return {
          id: t.id!,
          category: t.category || 'outros',
          description: t.description,
          amount: formatCurrency(expenseAmount),
          date: formatDate(t.date),
          paidDate: t.paidDate ? formatDate(t.paidDate) : undefined,
          status: t.status as Expense['status'],
          paymentMethod: t.paymentMethod,
          expenseType: (t.expenseType as Expense['expenseType']) || 'variavel',
          recurrence: t.recurrence as Expense['recurrence'],
          dueDay: t.dueDay,
          parentId: t.parentId,
          origemEventoId: t.origemEventoId,
          lastModifiedBy: t.lastModifiedBy,
          client: event?.client || t.client || '',
          eventType: event?.eventType,
          city: event?.city,
          receivedAmount: t.origemEventoId ? formatCurrency(eventRevenue) : '—',
          eventProfit: t.origemEventoId ? formatCurrency(eventRevenue - totalEventExpenses) : '—',
        };
      });

    const filteredExpenses = allExpenses.filter(exp => {
      if (viewMode === 'despesas' && (activeTab === 'fixas' || activeTab === 'variaveis')) {
        const expenseTypeMap: Record<string, string> = { fixas: 'fixa', variaveis: 'variavel' };
        if (exp.expenseType !== expenseTypeMap[activeTab]) return false;
      }
      if (activeFilters.categories?.length > 0) {
        if (!activeFilters.categories.includes(exp.category)) return false;
      }
      if (activeFilters.statuses?.length > 0) {
        const selectedLower = activeFilters.statuses.map(s => s.toLowerCase());
        if (!selectedLower.includes(exp.status.toLowerCase())) return false;
      }
      if (!isInDateRange(exp.date)) return false;
      if (activeFilters.minValue) {
        const min = parseFloat(activeFilters.minValue);
        if (parseBRL(exp.amount) < min) return false;
      }
      if (activeFilters.maxValue) {
        const max = parseFloat(activeFilters.maxValue);
        if (parseBRL(exp.amount) > max) return false;
      }
      return true;
    });

    const cards = viewMode === 'receitas'
      ? [
          { label: 'Total Recebido', icon: TrendingUp, iconColor: 'text-[#B5FF03]', value: totalRecebido, dimmed: false },
          { label: 'Receitas Pendentes', icon: Clock, iconColor: 'text-[#aaaaaa]', value: receitasPendentes, dimmed: false },
        ]
      : [
          { label: 'Fixas Pagas', icon: TrendingDown, iconColor: 'text-[#22c55e]', value: fixasPagas, dimmed: isVariaveisTab },
          { label: 'Fixas Pendentes', icon: Clock, iconColor: 'text-[#aaaaaa]', value: fixasPendentes, dimmed: isVariaveisTab },
          { label: 'Variáveis Pagas', icon: TrendingDown, iconColor: 'text-[#f97316]', value: variaveisPagas, dimmed: isFixasTab },
          { label: 'Variáveis Pendentes', icon: AlertTriangle, iconColor: 'text-[#f97316]', value: variaveisPendentes, dimmed: isFixasTab },
        ];

    const fluxo = {
      entradaRealizada: filteredInvoices.filter(inv => isPaid(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
      entradaPendente: filteredInvoices.filter(inv => !isPaid(inv.status) && !isCancelled(inv.status)).reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
      saidaRealizada: filteredExpenses.filter(exp => isPaid(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
      saidaPendente: filteredExpenses.filter(exp => isPending(exp.status)).reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
    };

    return { rawInvoices, allInvoices, filteredInvoices, allExpenses, filteredExpenses, cards, fluxo };
  }, [transactions, events, Orçamentos, activeFilters, viewMode, activeTab, isInDateRange, syncCounter]);

  const hasActiveFilters = activeFilters.period !== '' || activeFilters.statuses.length > 0 || 
    activeFilters.categories.length > 0 || activeFilters.origins.length > 0 || 
    activeFilters.minValue !== '' || activeFilters.maxValue !== '';

  const clearFilters = () => {
    const cleared = { ...initialFilterState };
    if (viewMode === 'receitas') setFiltersReceitas(cleared);
    else setFiltersDespesas(cleared);
  };

  useEffect(() => {
    const handler = () => setSyncCounter(c => c + 1);
    window.addEventListener('despesas-atualizadas', handler);
    return () => window.removeEventListener('despesas-atualizadas', handler);
  }, []);

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
    const inv = displayData.allInvoices.find(i => i.id === id);
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
      const defaultType: 'fixa' | 'variavel' = activeTab === 'fixas' ? 'fixa' : 'variavel';
      setEditingExpense({
        id: generateUUID(),
        category: 'outros',
        description: '',
        amount: '0,00',
        date: new Date().toISOString().split('T')[0],
        paidDate: '',
        status: 'Pendente',
        expenseType: defaultType,
        ...(defaultType === 'fixa' ? { recurrence: 'mensal' as const, dueDay: 1 } : {}),
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
    const expenseTypeToSet = isFixa ? 'fixa' : 'variavel';
      
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
          const payload: Record<string, unknown> = {
            type: 'despesa',
            description: editingExpense.description,
            category: editingExpense.category,
            amount: amountValue,
            date: editingExpense.date,
            status: editingExpense.status,
            source: 'manual',
            paymentMethod: editingExpense.paymentMethod || 'pix',
            expenseType: 'variavel',
            lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
          };
          if (editingExpense.origemEventoId) payload.origemEventoId = editingExpense.origemEventoId;
          if (editingExpense.paidDate) payload.paidDate = editingExpense.paidDate;
          await addTransaction(payload as any);
        }
      } catch (err) {
        console.error('[Finance] Erro ao salvar despesa:', err);
        alert('Erro ao salvar despesa. Verifique o console para detalhes.');
        return;
      }
    } else {
      try {
        const updatePayload: Record<string, unknown> = {
          description: editingExpense.description,
          category: editingExpense.category,
          amount: amountValue,
          date: editingExpense.date,
          status: editingExpense.status,
          paymentMethod: editingExpense.paymentMethod,
          expenseType: editingExpense.expenseType,
          lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
        };
        if (isFixa) {
          updatePayload.recurrence = editingExpense.recurrence;
          updatePayload.dueDay = editingExpense.dueDay;
        }
        if (editingExpense.origemEventoId) updatePayload.origemEventoId = editingExpense.origemEventoId;
        if (editingExpense.paidDate) updatePayload.paidDate = editingExpense.paidDate;
        if (editingExpense.installments) updatePayload.installments = editingExpense.installments;
        await updateTransaction(editingExpense.id, updatePayload as any);
      } catch (err) {
        console.error('[Finance] Erro ao atualizar despesa:', err);
        alert('Erro ao atualizar despesa. Verifique o console para detalhes.');
        return;
      }
    }
    setIsExpenseModalOpen(false);
    setActiveTab(expenseTypeToSet === 'fixa' ? 'fixas' : 'variaveis');
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
    Pago: 'badge badge-pago',
    Pendente: 'badge badge-pendente',
    Vencida: 'bg-[#111111] text-[#ff4444] font-black uppercase border border-[#ff4444]/50 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
    Cancelado: 'bg-[#111111] text-[#606060] font-black uppercase border border-[#333] rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
  };

  const expenseTypeBadge = (type?: string) => {
    if (type === 'fixa') return 'badge badge-fixa';
    return 'badge badge-variavel';
  };
    
  const categoryLabel = (cat: string) => {
    return FIXED_CATEGORIES.find(c => c.value === cat)?.label || cat;
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
        <h3 className="section-label">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#A0A0A0] hover:text-[#CCFF00] transition-colors flex items-center gap-1"
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
              <label className="section-label mb-1 block">De:</label>
              <input
                type="date"
                value={activeFilters.customDateStart}
                onChange={(e) => handleFilterChange(prev => ({ ...prev, customDateStart: e.target.value }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="section-label mb-1 block">Até:</label>
              <input
                type="date"
                value={activeFilters.customDateEnd}
                onChange={(e) => handleFilterChange(prev => ({ ...prev, customDateEnd: e.target.value }))}
                className="input-field w-full"
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
          {FIXED_CATEGORIES.map(cat => (
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
    <div className="min-h-screen bg-[#000000] text-white pb-bottom-nav md:pb-0">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="page-title">Financeiro</h1>
          <div className="flex flex-wrap gap-3">
            {viewMode === 'receitas' ? (
              <button
                onClick={() => handleOpenInvoiceModal()}
                className="btn-primary"
              >
                CRIAR FATURA
              </button>
            ) : (
              <button
                onClick={() => handleOpenExpenseModal()}
                className="btn-primary"
              >
                CRIAR DESPESA
              </button>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <SlidersHorizontal size={14} />
              FILTROS
            </button>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-6 md:px-8 pt-6 pb-2">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/financeiro/dashboard')}
            className="btn-secondary flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            DASHBOARD
          </button>
          <button
            onClick={() => { setViewMode('receitas'); setActiveTab('receitas'); }}
            className={`rounded-full px-5 py-2.5 font-bold text-xs uppercase tracking-widest transition-all duration-150 ${
              viewMode === 'receitas'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#111111] text-white border border-[rgba(255,255,255,0.2)] hover:border-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            RECEITAS
          </button>
          <button
            onClick={() => { setViewMode('despesas'); setActiveTab('fixas'); }}
            className={`rounded-full px-5 py-2.5 font-bold text-xs uppercase tracking-widest transition-all duration-150 ${
              viewMode === 'despesas'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#111111] text-white border border-[rgba(255,255,255,0.2)] hover:border-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            DESPESAS
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`p-6 md:px-8 grid grid-cols-1 gap-4 ${viewMode === 'receitas' ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
        {Object.values(displayData.cards).map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`card p-6 transition-opacity ${
                card.dimmed ? 'opacity-40' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="card-label">{card.label}</span>
                <Icon size={16} className={card.iconColor} />
              </div>
              <p className="card-value">{formatCurrency(card.value)}</p>
            </div>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="px-6 md:px-8 border-b border-[rgba(255,255,255,0.08)] overflow-x-auto">
        {viewMode === 'receitas' ? (
          <div className="flex gap-6 whitespace-nowrap">
            <button
              onClick={() => setActiveTab('receitas')}
              className={`py-3.5 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'receitas'
                  ? 'border-[#CCFF00] text-[#CCFF00]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              Receitas ({displayData.filteredInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`py-3.5 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fluxo'
                  ? 'border-[#CCFF00] text-[#CCFF00]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              Fluxo de Caixa ({displayData.filteredExpenses.length + displayData.filteredInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('projecao')}
              className={`py-3.5 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'projecao'
                  ? 'border-[#CCFF00] text-[#CCFF00]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              Projeção (Parcelas)
            </button>
          </div>
        ) : (
          <div className="flex gap-6 whitespace-nowrap">
            <button
              onClick={() => setActiveTab('fixas')}
              className={`py-3.5 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fixas'
                  ? 'border-[#CCFF00] text-[#CCFF00]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              Fixas ({displayData.allExpenses.filter(e => e.expenseType === 'fixa').length})
            </button>
            <button
              onClick={() => setActiveTab('variaveis')}
              className={`py-3.5 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'variaveis'
                  ? 'border-[#CCFF00] text-[#CCFF00]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              Variáveis ({displayData.allExpenses.filter(e => e.expenseType === 'variavel').length})
            </button>
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === 'fluxo'
                  ? 'border-[#B5FF03] text-[#B5FF03]'
                  : 'border-transparent text-[#aaaaaa] hover:text-white'
              }`}
            >
              Fluxo de Saídas ({displayData.filteredExpenses.length})
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
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Cidade</th>
                    <th className="table-header">Tipo de Evento</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Pagamento</th>
                    <th className="table-header">Valor do Evento</th>
                    <th className="table-header">Despesas do Evento</th>
                    <th className="table-header">Lucro do Evento</th>
                    <th className="table-header text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="table-row">
                      <td className="table-cell text-white">{invoice.client}</td>
                      <td className="table-cell text-[#A0A0A0]">{invoice.city || '—'}</td>
                      <td className="table-cell text-[#A0A0A0]">{eventTypeLabel(invoice.eventType)}</td>
                      <td className="table-cell text-[#A0A0A0]">{invoice.date}</td>
                      <td className="table-cell">
                        <span className={statusStyle[invoice.status]}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="table-cell text-[#A0A0A0]">{paymentMethodLabel(invoice.paymentMethod, invoice.installments)}</td>
                      <td className="table-cell text-white">{invoice.amount}</td>
                      <td className="table-cell text-[#A0A0A0]">{invoice.totalExpenses || '—'}</td>
                      <td className={`table-cell ${(parseBRL(invoice.profit || '0') || 0) >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>{invoice.profit || '—'}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleOpenInvoiceModal(invoice)}
                          className="btn-destructive"
                        >
                          <Pencil size={16} className="table-action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayData.filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={10} className="table-cell text-center text-[#606060] py-8">
                        Nenhuma fatura encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {displayData.filteredInvoices.map(invoice => (
                <div key={invoice.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{invoice.client}</span>
                    <span className={statusStyle[invoice.status]}>{invoice.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Cidade:</span> <span className="text-white">{invoice.city || '—'}</span></div>
                    <div><span className="text-[#606060]">Tipo:</span> <span className="text-white">{eventTypeLabel(invoice.eventType)}</span></div>
                    <div><span className="text-[#606060]">Data:</span> <span className="text-white">{invoice.date}</span></div>
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{invoice.amount}</span></div>
                    <div><span className="text-[#606060]">Despesas:</span> <span className="text-white">{invoice.totalExpenses || '—'}</span></div>
                    <div><span className="text-[#606060]">Lucro:</span> <span className="text-white">{invoice.profit || '—'}</span></div>
                    <div><span className="text-[#606060]">Pagamento:</span> <span className="text-white">{paymentMethodLabel(invoice.paymentMethod, invoice.installments)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <button onClick={() => handleOpenInvoiceModal(invoice)} className="text-[#CCFF00] p-2 min-h-[44px]"><Pencil size={18} /></button>
                  </div>
                </div>
              ))}
              {displayData.filteredInvoices.length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhuma fatura encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Receitas View - FLUXO DE CAIXA tab */}
          {viewMode === 'receitas' && activeTab === 'fluxo' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Entradas Realizadas</span>
                  <TrendingUp size={16} className="text-[#CCFF00]" />
                </div>
                <p className="card-value text-[#CCFF00]">{formatCurrency(displayData.fluxo.entradaRealizada)}</p>
              </div>
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Entradas Pendentes</span>
                  <Clock size={16} className="text-[#FFB800]" />
                </div>
                <p className="card-value text-white">{formatCurrency(displayData.fluxo.entradaPendente)}</p>
              </div>
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Saídas Realizadas</span>
                  <TrendingDown size={16} className="text-[#FF4444]" />
                </div>
                <p className="card-value text-[#FF4444]">{formatCurrency(displayData.fluxo.saidaRealizada)}</p>
              </div>
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Saídas Pendentes</span>
                  <AlertTriangle size={16} className="text-[#FF4444]" />
                </div>
                <p className="card-value text-[#FF4444]">{formatCurrency(displayData.fluxo.saidaPendente)}</p>
              </div>
            </div>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Tipo</th>
                    <th className="table-header">Descrição</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...displayData.filteredInvoices, ...displayData.filteredExpenses]
                    .sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime())
                    .map(item => {
                      const isInvoice = 'client' in item;
                      return (
                        <tr key={item.id} className="table-row">
                          <td className="table-cell">
                            <span className={isInvoice ? 'text-[#CCFF00]' : 'text-[#FF4444]'}>
                              {isInvoice ? 'Receita' : 'Despesa'}
                            </span>
                          </td>
                          <td className="table-cell text-white">{isInvoice ? (item as Invoice).client : (item as Expense).description}</td>
                          <td className="table-cell text-white">{item.amount}</td>
                          <td className="table-cell text-[#A0A0A0]">{item.date}</td>
                          <td className="table-cell">
                            <span className={statusStyle[item.status]}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {displayData.filteredInvoices.length === 0 && displayData.filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-cell text-center text-[#606060] py-8">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {[...displayData.filteredInvoices, ...displayData.filteredExpenses]
                .sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime())
                .map(item => {
                  const isInvoice = 'client' in item;
                  return (
                    <div key={item.id} className="card p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className={`font-bold text-sm ${isInvoice ? 'text-[#CCFF00]' : 'text-[#FF4444]'}`}>
                          {isInvoice ? 'Receita' : 'Despesa'}
                        </span>
                        <span className={statusStyle[item.status]}>{item.status}</span>
                      </div>
                      <div className="text-sm text-white">{isInvoice ? (item as Invoice).client : (item as Expense).description}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{item.amount}</span></div>
                        <div><span className="text-[#606060]">Data:</span> <span className="text-white">{item.date}</span></div>
                      </div>
                    </div>
                  );
                })}
              {displayData.filteredInvoices.length === 0 && displayData.filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhum registro encontrado</p>
              )}
            </div>
            </>
          )}

          {/* Receitas View - PROJEÇÃO tab */}
          {viewMode === 'receitas' && activeTab === 'projecao' && (
            <>
            <div className="mb-4">
              <h2 className="page-title text-xl mb-1">Projeção de Receitas</h2>
              <p className="text-sm text-[#606060]">Faturamento futuro projetado com base em contratos parcelados.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(() => {
                const projectedInvoices = displayData.allInvoices.filter(inv => (inv.paymentMethod === 'parcelado' || inv.paymentMethod === 'credito') && inv.status !== 'Cancelado');
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
                    <div key={month} className="card p-6">
                      <div className="card-label mb-2">
                        {monthNames[parseInt(m) - 1]} {y}
                      </div>
                      <div className="card-value text-[#CCFF00]">{formatCurrency(total)}</div>
                      <div className="text-[11px] text-[#606060] mt-1">{projectedInvoices.filter(inv => inv.date?.startsWith(month)).length} parcela(s)</div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Data Prevista</th>
                    <th className="table-header">Parcela</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.allInvoices.filter(inv => inv.paymentMethod === 'parcelado' || inv.paymentMethod === 'credito').sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime()).map(inv => (
                    <tr key={inv.id} className="table-row">
                      <td className="table-cell text-white">{inv.client}</td>
                      <td className="table-cell text-white">{inv.amount}</td>
                      <td className="table-cell text-[#A0A0A0]">{inv.date}</td>
                      <td className="table-cell text-[#A0A0A0]">{inv.installments ? `${inv.installments}x` : '—'}</td>
                      <td className="table-cell">
                        <span className={statusStyle[inv.status] || statusStyle.Pendente}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {displayData.allInvoices.filter(inv => inv.paymentMethod === 'parcelado' || inv.paymentMethod === 'credito').length === 0 && (
                    <tr><td colSpan={5} className="table-cell text-center text-[#606060] py-8">Nenhuma projeção disponível.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {displayData.allInvoices.filter(inv => inv.paymentMethod === 'parcelado' || inv.paymentMethod === 'credito').sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime()).map(inv => (
                <div key={inv.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{inv.client}</span>
                    <span className={statusStyle[inv.status] || statusStyle.Pendente}>{inv.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{inv.amount}</span></div>
                    <div><span className="text-[#606060]">Data:</span> <span className="text-white">{inv.date}</span></div>
                    <div><span className="text-[#606060]">Parcela:</span> <span className="text-white">{inv.installments ? `${inv.installments}x` : '—'}</span></div>
                  </div>
                </div>
              ))}
              {displayData.allInvoices.filter(inv => inv.paymentMethod === 'parcelado' || inv.paymentMethod === 'credito').length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhuma projeção disponível.</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - FIXAS tab */}
          {viewMode === 'despesas' && activeTab === 'fixas' && (
            <>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Categoria</th>
                    <th className="table-header">Descrição</th>
                    <th className="table-header">Vencimento</th>
                    <th className="table-header">Pagamento</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Forma Pagto.</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.filteredExpenses.map(expense => (
                    <tr key={expense.id} className="table-row">
                      <td className="table-cell text-[#A0A0A0]">{categoryLabel(expense.category)}</td>
                      <td className="table-cell text-white">{expense.description}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.date}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.paidDate || '—'}</td>
                      <td className="table-cell">
                        <span className={statusStyle[expense.status]}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="table-cell text-[#A0A0A0]">{paymentMethodLabel(expense.paymentMethod)}</td>
                      <td className="table-cell text-white">{expense.amount}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleOpenExpenseModal(expense)}
                          className="btn-destructive mr-2"
                        >
                          <Pencil size={16} className="table-action-icon" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          className="btn-destructive"
                        >
                          <Trash2 size={16} className="table-action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayData.filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={8} className="table-cell text-center text-[#606060] py-8">
                        Nenhuma despesa fixa encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {displayData.filteredExpenses.map(expense => (
                <div key={expense.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{expense.description}</span>
                    <span className={statusStyle[expense.status]}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Categoria:</span> <span className="text-white">{categoryLabel(expense.category)}</span></div>
                    <div><span className="text-[#606060]">Vencimento:</span> <span className="text-white">{expense.date}</span></div>
                    <div><span className="text-[#606060]">Pagamento:</span> <span className="text-white">{expense.paidDate || '—'}</span></div>
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-[#606060]">Forma Pagto.:</span> <span className="text-white">{paymentMethodLabel(expense.paymentMethod)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <button onClick={() => handleOpenExpenseModal(expense)} className="text-[#CCFF00] p-2 min-h-[44px]"><Pencil size={18} /></button>
                    <button onClick={() => handleDeleteExpense(expense)} className="text-[#FF4444] p-2 min-h-[44px]"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {displayData.filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhuma despesa fixa encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - VARIÁVEIS tab */}
          {viewMode === 'despesas' && activeTab === 'variaveis' && (
            <>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Cidade</th>
                    <th className="table-header">Tipo de Evento</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Pagamento</th>
                    <th className="table-header">Valor da Despesa</th>
                    <th className="table-header">Valor Recebido</th>
                    <th className="table-header">Lucro do Evento</th>
                    <th className="table-header text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.filteredExpenses.map(expense => (
                    <tr key={expense.id} className="table-row">
                      <td className="table-cell text-white">{expense.client || '—'}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.city || '—'}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.eventType ? eventTypeLabel(expense.eventType) : expense.category ? categoryLabel(expense.category) : '—'}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.date}</td>
                      <td className="table-cell">
                        <span className={statusStyle[expense.status]}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="table-cell text-[#A0A0A0]">{paymentMethodLabel(expense.paymentMethod)}</td>
                      <td className="table-cell text-white">{expense.amount}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.receivedAmount || '—'}</td>
                      <td className={`table-cell ${(parseBRL(expense.eventProfit || '0') || 0) >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>{expense.eventProfit || '—'}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleOpenExpenseModal(expense)}
                          className="btn-destructive mr-2"
                        >
                          <Pencil size={16} className="table-action-icon" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          className="btn-destructive"
                        >
                          <Trash2 size={16} className="table-action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayData.filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={10} className="table-cell text-center text-[#606060] py-8">
                        Nenhuma despesa variável encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {displayData.filteredExpenses.map(expense => (
                <div key={expense.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{expense.client || expense.description}</span>
                    <span className={statusStyle[expense.status]}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Cidade:</span> <span className="text-white">{expense.city || '—'}</span></div>
                    <div><span className="text-[#606060]">Evento:</span> <span className="text-white">{eventTypeLabel(expense.eventType)}</span></div>
                    <div><span className="text-[#606060]">Data:</span> <span className="text-white">{expense.date}</span></div>
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-[#606060]">Recebido:</span> <span className="text-white">{expense.receivedAmount || '—'}</span></div>
                    <div><span className="text-[#606060]">Lucro:</span> <span className="text-white">{expense.eventProfit || '—'}</span></div>
                    <div><span className="text-[#606060]">Pagamento:</span> <span className="text-white">{paymentMethodLabel(expense.paymentMethod)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <button onClick={() => handleOpenExpenseModal(expense)} className="text-[#CCFF00] p-2 min-h-[44px]"><Pencil size={18} /></button>
                    <button onClick={() => handleDeleteExpense(expense)} className="text-[#FF4444] p-2 min-h-[44px]"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {displayData.filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#aaaaaa] py-8">Nenhuma despesa variável encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - FLUXO DE SAÍDAS tab */}
          {viewMode === 'despesas' && activeTab === 'fluxo' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Total Pago</span>
                  <TrendingDown size={16} className="text-[#FF4444]" />
                </div>
                <p className="card-value text-[#FF4444]">{formatCurrency(displayData.fluxo.saidaRealizada)}</p>
              </div>
              <div className="card p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="card-label">Saídas Pendentes</span>
                  <AlertTriangle size={16} className="text-[#FF4444]" />
                </div>
                <p className="card-value text-[#FF4444]">{formatCurrency(displayData.fluxo.saidaPendente)}</p>
              </div>
            </div>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Descrição</th>
                    <th className="table-header">Tipo</th>
                    <th className="table-header">Categoria</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.filteredExpenses.map(expense => (
                    <tr key={expense.id} className="table-row">
                      <td className="table-cell text-white">{expense.description}</td>
                      <td className="table-cell">
                        <span className={expenseTypeBadge(expense.expenseType)}>
                          {expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}
                        </span>
                      </td>
                      <td className="table-cell text-[#A0A0A0]">{categoryLabel(expense.category)}</td>
                      <td className="table-cell text-white">{expense.amount}</td>
                      <td className="table-cell text-[#A0A0A0]">{expense.date}</td>
                      <td className="table-cell">
                        <span className={statusStyle[expense.status]}>
                          {expense.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {displayData.filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-cell text-center text-[#606060] py-8">
                        Nenhuma despesa encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {displayData.filteredExpenses.map(expense => (
                <div key={expense.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{expense.description}</span>
                    <span className={statusStyle[expense.status]}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Tipo:</span> <span className={expenseTypeBadge(expense.expenseType)}>{expense.expenseType === 'fixa' ? 'FIXA' : 'VARIÁVEL'}</span></div>
                    <div><span className="text-[#606060]">Categoria:</span> <span className="text-white">{categoryLabel(expense.category)}</span></div>
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-[#606060]">Data:</span> <span className="text-white">{expense.date}</span></div>
                  </div>
                </div>
              ))}
              {displayData.filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhuma despesa encontrada</p>
              )}
            </div>
            </>
          )}

          {/* Despesas View - PROJEÇÃO tab */}
          {viewMode === 'despesas' && activeTab === 'projecao' && (
            <>
            <div className="mb-4">
              <h2 className="page-title text-xl mb-1">Projeção de Despesas</h2>
              <p className="text-sm text-[#606060]">Despesas futuras projetadas.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(() => {
                const projected = displayData.allExpenses.filter(exp => (exp.paymentMethod === 'parcelado' || exp.paymentMethod === 'credito') && exp.status !== 'Pago');
                const projectionByMonth: Record<string, number> = {};
                projected.forEach(exp => {
                  if (!exp.date || exp.date === '—') return;
                  const monthKey = exp.date.substring(0, 7);
                  projectionByMonth[monthKey] = (projectionByMonth[monthKey] || 0) + parseBRL(exp.amount);
                });
                const sortedMonths = Object.entries(projectionByMonth).sort(([a], [b]) => a.localeCompare(b));
                return sortedMonths.slice(0, 12).map(([month, total]) => {
                  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const [y, m] = month.split('-');
                  return (
                    <div key={month} className="card p-6">
                      <div className="card-label mb-2">
                        {monthNames[parseInt(m) - 1]} {y}
                      </div>
                      <div className="card-value text-[#FF4444]">{formatCurrency(total)}</div>
                      <div className="text-[11px] text-[#606060] mt-1">{projected.filter(exp => exp.date?.startsWith(month)).length} parcela(s)</div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="card overflow-x-auto hidden md:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    <th className="table-header">Descrição</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Data Prevista</th>
                    <th className="table-header">Parcela</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.allExpenses.filter(exp => exp.paymentMethod === 'parcelado' || exp.paymentMethod === 'credito').sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime()).map(exp => (
                    <tr key={exp.id} className="table-row">
                      <td className="table-cell text-white">{exp.description}</td>
                      <td className="table-cell text-white">{exp.amount}</td>
                      <td className="table-cell text-[#A0A0A0]">{exp.date}</td>
                      <td className="table-cell text-[#A0A0A0]">{exp.installments ? `${exp.installments}x` : '—'}</td>
                      <td className="table-cell">
                        <span className={statusStyle[exp.status] || statusStyle.Pendente}>
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {displayData.allExpenses.filter(exp => exp.paymentMethod === 'parcelado' || exp.paymentMethod === 'credito').length === 0 && (
                    <tr><td colSpan={5} className="table-cell text-center text-[#606060] py-8">Nenhuma projeção disponível.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {displayData.allExpenses.filter(exp => exp.paymentMethod === 'parcelado' || exp.paymentMethod === 'credito').sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime()).map(exp => (
                <div key={exp.id} className="card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{exp.description}</span>
                    <span className={statusStyle[exp.status] || statusStyle.Pendente}>{exp.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#606060]">Valor:</span> <span className="text-white">{exp.amount}</span></div>
                    <div><span className="text-[#606060]">Data:</span> <span className="text-white">{exp.date}</span></div>
                    <div><span className="text-[#606060]">Parcela:</span> <span className="text-white">{exp.installments ? `${exp.installments}x` : '—'}</span></div>
                  </div>
                </div>
              ))}
              {displayData.allExpenses.filter(exp => exp.paymentMethod === 'parcelado' || exp.paymentMethod === 'credito').length === 0 && (
                <p className="text-center text-sm text-[#606060] py-8">Nenhuma projeção disponível.</p>
              )}
            </div>
            </>
          )}
        </div>
        
        {/* Filter Sidebar */}
        {isSidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed inset-x-0 bottom-0 z-[100] bg-surface-cardAlt border-t border-[rgba(255,255,255,0.08)] rounded-t-2xl p-4 max-h-[70dvh] overflow-y-auto md:hidden" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {filterContent}
            </div>
            <div className="hidden md:block w-64 bg-surface-cardAlt border-l border-[rgba(255,255,255,0.08)] p-4 overflow-y-auto max-h-screen sticky top-0">
              {filterContent}
            </div>
          </>
        )}
      </div>

      {/* Delete Recurring Expense Dialog */}
      {deleteDialog.show && deleteDialog.expense && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
          <div className="card w-full max-w-md p-8">
            <h3 className="text-lg font-extrabold text-white mb-4">Excluir Despesa Fixa</h3>
            <p className="text-sm text-[#A0A0A0] mb-6">Deseja excluir apenas este lançamento ou todos os futuros?</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setDeleteDialog({ expense: null as unknown as Expense, show: false })}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSingleExpense(deleteDialog.expense.id)}
                className="btn-destructive btn-secondary border-[#FF4444]/50 hover:border-[#FF4444]"
              >
                Só Este
              </button>
              <button
                onClick={() => handleDeleteAllFutureExpenses(deleteDialog.expense)}
                className="bg-[#FF4444] text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-[#CC3333]"
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
          <div className="card w-full max-w-full md:max-w-md p-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold text-white">
                {isNewInvoice ? 'Nova Fatura' : 'Editar Fatura'}
              </h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-[#A0A0A0] hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveInvoice} className="space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="section-label mb-2 block">Cliente</label>
                <input
                  type="text"
                  value={editingInvoice.client}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, client: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Valor (R$)</label>
                <input
                  type="text"
                  value={editingInvoice.amount}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Data</label>
                <input
                  type="date"
                  value={editingInvoice.date}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Status</label>
                <select
                  value={editingInvoice.status}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value as Invoice['status'] })}
                  className="input-field w-full"
                >
                  {INVOICE_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label mb-2 block">Forma de Pagamento</label>
                <select
                  value={editingInvoice.paymentMethod || ''}
                  onChange={(e) => setEditingInvoice({
                    ...editingInvoice,
                    paymentMethod: e.target.value,
                    installments: e.target.value !== 'parcelado' && e.target.value !== 'credito' ? '' : editingInvoice.installments
                  })}
                  className="input-field w-full"
                >
                  <option value="">Selecionar</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: editingInvoice.paymentMethod === 'parcelado' || editingInvoice.paymentMethod === 'credito' ? 'block' : 'none' }}>
                <label className="section-label mb-2 block">Qtd. Parcelas</label>
                <select
                  value={editingInvoice.installments || '1'}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, installments: e.target.value })}
                  className="input-field w-full"
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
                    className="btn-secondary border-[#FF4444]/50 text-[#FF4444] hover:border-[#FF4444]"
                  >
                    EXCLUIR
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-primary"
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
          <div className="card w-full max-w-full md:max-w-md p-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-lg font-extrabold text-white">
                {isNewExpense ? 'Nova Despesa' : 'Editar Despesa'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#A0A0A0] hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-5 overflow-y-auto flex-1 min-h-0">
              {/* Tipo de Despesa */}
              <div>
                <label className="section-label mb-3 block">Tipo de Despesa</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${editingExpense.expenseType === 'fixa' ? 'bg-[#4488FF] border-[#4488FF]' : 'border-[rgba(255,255,255,0.2)]'}`}>
                      {editingExpense.expenseType === 'fixa' && <div className="w-2 h-2 bg-black rounded-full" />}
                    </div>
                    <input
                      type="radio"
                      className="hidden"
                      checked={editingExpense.expenseType === 'fixa'}
                      onChange={() => setEditingExpense({ ...editingExpense, expenseType: 'fixa', recurrence: 'mensal', dueDay: 1 })}
                    />
                    <span className="text-xs font-semibold text-white">Fixa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${editingExpense.expenseType === 'variavel' ? 'bg-[#FF8C00] border-[#FF8C00]' : 'border-[rgba(255,255,255,0.2)]'}`}>
                      {editingExpense.expenseType === 'variavel' && <div className="w-2 h-2 bg-black rounded-full" />}
                    </div>
                    <input
                      type="radio"
                      className="hidden"
                      checked={editingExpense.expenseType === 'variavel'}
                      onChange={() => setEditingExpense({ ...editingExpense, expenseType: 'variavel', recurrence: undefined, dueDay: undefined })}
                    />
                    <span className="text-xs font-semibold text-white">Variável</span>
                  </label>
                </div>
              </div>

              {/* FIXA: Recorrência */}
              {editingExpense.expenseType === 'fixa' && (
                <>
                <div>
                  <label className="section-label mb-2 block">Recorrência</label>
                  <select
                    value={editingExpense.recurrence || 'mensal'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, recurrence: e.target.value as Expense['recurrence'] })}
                    className="input-field w-full"
                  >
                    {RECURRENCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="section-label mb-2 block">Dia de Vencimento</label>
                  <select
                    value={editingExpense.dueDay || 1}
                    onChange={(e) => setEditingExpense({ ...editingExpense, dueDay: Number(e.target.value) })}
                    className="input-field w-full"
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
                  <label className="section-label mb-2 block">Evento Vinculado (opcional)</label>
                  <select
                    value={editingExpense.origemEventoId || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, origemEventoId: e.target.value || undefined })}
                    className="input-field w-full"
                  >
                    <option value="">Nenhum</option>
                    {(events || []).filter(e => e.status !== 'cancelado').map(event => (
                      <option key={event.id} value={event.id}>{event.title} - {event.client || 'Sem cliente'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="section-label mb-2 block">Categoria</label>
                {editingExpense.expenseType === 'fixa' ? (
                  <select
                    value={editingExpense.category}
                    onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                    className="input-field w-full"
                  >
                    {FIXED_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editingExpense.category}
                    onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                    className="input-field w-full"
                    placeholder="Digite a categoria da despesa..."
                  />
                )}
              </div>
              <div>
                <label className="section-label mb-2 block">Descrição</label>
                <input
                  type="text"
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Valor (R$)</label>
                <input
                  type="text"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">
                  {editingExpense.expenseType === 'fixa' ? 'Primeiro Vencimento' : 'Data de Vencimento'}
                </label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Data de Pagamento</label>
                <input
                  type="date"
                  value={editingExpense.paidDate || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, paidDate: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Forma de Pagamento</label>
                <select
                  value={editingExpense.paymentMethod || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">Selecionar</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: editingExpense.paymentMethod === 'credito' ? 'block' : 'none' }}>
                <label className="section-label mb-2 block">Qtd. Parcelas</label>
                <select
                  value={editingExpense.installments || '1'}
                  onChange={(e) => setEditingExpense({ ...editingExpense, installments: e.target.value })}
                  className="input-field w-full"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={String(n)}>{n}x</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label mb-2 block">Status</label>
                <select
                  value={editingExpense.status}
                  onChange={(e) => setEditingExpense({ ...editingExpense, status: e.target.value as Expense['status'] })}
                  className="input-field w-full"
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
                    className="btn-secondary border-[#FF4444]/50 text-[#FF4444] hover:border-[#FF4444]"
                  >
                    EXCLUIR
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-primary"
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
