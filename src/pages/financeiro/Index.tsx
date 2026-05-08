import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCRM } from '../../contexts/CRMContext';
import { useFilters } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateUUID } from '../../lib/uuid';
import { Plus, Pencil, Save, X, TrendingUp, TrendingDown, DollarSign, PieChart, CreditCard, User, Calendar, CheckCircle2, Clock, AlertTriangle, RefreshCw, ExternalLink, Receipt, Wallet, Filter, XCircle, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

interface Invoice {
  id: string;
  client: string;
  amount: string;
  date: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  lastModifiedBy?: string;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  status: 'Pago' | 'Pendente' | 'Cancelado';
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

const paymentMethodLabel = (value?: string) =>
  PAYMENT_METHODS.find(pm => pm.value === value)?.label || value || '—';

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
        {isOpen ? <ChevronUp size={14} className="text-[#888888]" /> : <ChevronDown size={14} className="text-[#888888]" />}
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
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#888888]'}`}>{label}</span>
  </label>
);

const RadioFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1">
    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${checked ? 'bg-[#B5FF03] border-[#B5FF03]' : 'border-[#222222] group-hover:border-[#B5FF03]'}`}>
      {checked && <div className="w-2 h-2 bg-black rounded-full" />}
    </div>
    <input type="radio" className="hidden" checked={checked} onChange={onChange} />
    <span className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#888888]'}`}>{label}</span>
  </label>
);

const Financeiro = () => {
  const { Orçamentos } = useCRM();
  const { filters } = useFilters();
  const { role, employeeName } = useAuth();

  const STORAGE_KEY = 'axium_finance_v2';
  const EXPENSES_KEY = 'axium_expenses_v1';

  const getStoredFinance = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    return { revenue: 0, expenses: 0, revenueOverride: null };
  };

  const [financeData, setFinanceData] = useState(getStoredFinance);
  const [activeTab, setActiveTab] = useState<'receitas' | 'fluxo'>('receitas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(financeData));
  }, [financeData]);

  const [filtersState, setFiltersState] = useState({
    period: '' as '' | 'this_month' | 'last_month' | '90_days' | 'custom',
    customDateStart: '',
    customDateEnd: '',
    statuses: [] as string[],
    categories: [] as string[],
    origins: [] as string[],
    minValue: '',
    maxValue: '',
  });

  const parseBRL = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(clean) || 0;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };
    
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
    if (filtersState.period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    } else if (filtersState.period === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    } else if (filtersState.period === '90_days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: today };
    } else if (filtersState.period === 'custom' && filtersState.customDateStart && filtersState.customDateEnd) {
      return { 
        start: new Date(filtersState.customDateStart), 
        end: new Date(filtersState.customDateEnd) 
      };
    }
    return null;
  };

  const isInDateRange = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return true;
    const range = getDateRange();
    if (!range) return true;
    const date = new Date(dateStr);
    return date >= range.start && date <= range.end;
  };
    
  const [isAsaasConnected] = useState(localStorage.getItem('axium_int_asaas') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [manualInvoices, setManualInvoices] = useState<Invoice[]>(() => {
    const stored = localStorage.getItem('axium_finance_v1');
    if (stored) return JSON.parse(stored).manualInvoices ?? [];
    return [];
  });
  const [asaasInvoices, setAsaasInvoices] = useState<Invoice[]>([]);
    
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const stored = localStorage.getItem(EXPENSES_KEY);
    if (stored) return JSON.parse(stored);
    return [
      { id: 'exp-001', category: 'aluguel', description: 'Aluguel do escritório', amount: 'R$ 5.000,00', date: '2026-04-01', status: 'Pago' },
      { id: 'exp-002', category: 'software', description: 'Assinatura CRM', amount: 'R$ 497,00', date: '2026-04-05', status: 'Pago' },
      { id: 'exp-003', category: 'marketing', description: 'Ads Google', amount: 'R$ 2.500,00', date: '2026-04-10', status: 'Pendente' },
      { id: 'exp-004', category: 'salarios', description: 'Folha de pagamento', amount: 'R$ 25.000,00', date: '2026-04-15', status: 'Pago' },
      { id: 'exp-005', category: 'luz', description: 'Conta de luz', amount: 'R$ 1.200,00', date: '2026-04-18', status: 'Pago' },
      { id: 'exp-006', category: 'internet', description: 'Internet corporativa', amount: 'R$ 299,00', date: '2026-04-20', status: 'Pago' },
    ];
  });

  useEffect(() => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('axium_finance_v1', JSON.stringify({ manualInvoices }));
  }, [manualInvoices]);
    
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isNewInvoice, setIsNewInvoice] = useState(false);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isNewExpense, setIsNewExpense] = useState(false);

  const syncAsaasData = useCallback(async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
      
    const mockAsaas: Invoice[] = [
      { id: 'PAY-827364', client: 'Clínica Sorriso', amount: 'R$ 15.000,00', date: '2026-04-20', status: 'Pago', source: 'asaas', paymentMethod: 'pix' },
      { id: 'PAY-918273', client: 'João Silva', amount: 'R$ 5.000,00', date: '2026-04-21', status: 'Pago', source: 'asaas', paymentMethod: 'credito' },
      { id: 'PAY-102938', client: 'Maria Santos', amount: 'R$ 8.000,00', date: '2026-04-25', status: 'Pendente', source: 'asaas', paymentMethod: 'boleto' },
      { id: 'PAY-445566', client: 'Odonto Master', amount: 'R$ 22.500,00', date: '2026-04-18', status: 'Pago', source: 'asaas', paymentMethod: 'pix' },
    ];
      
    setAsaasInvoices(mockAsaas);
    setLastSync(new Date().toLocaleTimeString());
    setIsSyncing(false);
  }, []);
    
  const computedLeadInvoices: Invoice[] = (Orçamentos || [])
    .filter(l => l.stage === 'Contrato Fechado')
    .map(l => ({
      id: `lead-${l.id}`,
      client: l.name,
      amount: l.value || 'R$ 0,00',
      date: l.closingDate || '—',
      status: 'Pago',
      source: 'lead',
      paymentMethod: 'pix',
    }));
    
  const allInvoices = useMemo(() => 
    [...asaasInvoices, ...manualInvoices, ...computedLeadInvoices].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [asaasInvoices, manualInvoices, Orçamentos]);

  const filteredInvoices = useMemo(() => {
    let result = allInvoices || [];
      
    if (filtersState.statuses?.length > 0) {
      result = result.filter(inv => filtersState.statuses.includes(inv.status));
    }
      
    if (filtersState.origins?.length > 0) {
      result = result.filter(inv => {
        const method = inv.paymentMethod || '';
        return filtersState.origins.includes(method);
      });
    }
      
    result = result.filter(inv => isInDateRange(inv.date));
      
    if (filtersState.minValue) {
      const min = parseFloat(filtersState.minValue);
      result = result.filter(inv => parseBRL(inv.amount) >= min);
    }
    if (filtersState.maxValue) {
      const max = parseFloat(filtersState.maxValue);
      result = result.filter(inv => parseBRL(inv.amount) <= max);
    }
      
    return result;
  }, [allInvoices, filtersState]);
    
  const filteredExpenses = useMemo(() => {
    let result = expenses || [];
      
    if (activeTab === 'fluxo' && filtersState.categories?.length > 0) {
      result = result.filter(exp => filtersState.categories.includes(exp.category));
    }
      
    if (filtersState.statuses?.length > 0) {
      result = result.filter(exp => filtersState.statuses.includes(exp.status));
    }
      
    result = result.filter(exp => isInDateRange(exp.date));
      
    if (filtersState.minValue) {
      const min = parseFloat(filtersState.minValue);
      result = result.filter(exp => parseBRL(exp.amount) >= min);
    }
    if (filtersState.maxValue) {
      const max = parseFloat(filtersState.maxValue);
      result = result.filter(exp => parseBRL(exp.amount) <= max);
    }
      
    return result;
  }, [expenses, filtersState, activeTab]);
    
  const computedTotalRevenue = useMemo(() => 
    filteredInvoices
      .filter(inv => inv.status === 'Pago')
      .reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
  [filteredInvoices]);
    
  const computedPendingRevenue = useMemo(() => 
    filteredInvoices
      .filter(inv => inv.status !== 'Pago' && inv.status !== 'Cancelado')
      .reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
  [filteredInvoices]);
    
  const computedTotalExpenses = useMemo(() => 
    filteredExpenses
      .filter(exp => exp.status === 'Pago')
      .reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
  [filteredExpenses]);
    
  const computedPendingExpenses = useMemo(() => 
    filteredExpenses
      .filter(exp => exp.status === 'Pendente')
      .reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
  [filteredExpenses]);
    
  const computedNetProfit = computedTotalRevenue - computedTotalExpenses;
    
  const hasActiveFilters = filtersState.period !== '' || filtersState.statuses.length > 0 || 
    filtersState.categories.length > 0 || filtersState.origins.length > 0 || 
    filtersState.minValue !== '' || filtersState.maxValue !== '';
    
  const clearFilters = () => {
    setFiltersState({
      period: '',
      customDateStart: '',
      customDateEnd: '',
      statuses: [],
      categories: [],
      origins: [],
      minValue: '',
      maxValue: '',
    });
  };
    
  const handleOpenInvoiceModal = (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setIsNewInvoice(false);
    } else {
      setEditingInvoice({
        id: generateUUID(),
        client: '',
        amount: 'R$ 0,00',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        source: 'manual'
      });
      setIsNewInvoice(true);
    }
    setIsInvoiceModalOpen(true);
  };
    
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
      
    const modifiedInvoice = {
      ...editingInvoice,
      source: 'manual' as const,
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário')
    };
      
    if (isNewInvoice) {
      setManualInvoices(prev => [modifiedInvoice, ...prev]);
    } else {
      setManualInvoices(prev => {
        const exists = prev.find(inv => inv.id === editingInvoice.id);
        if (exists) {
          return prev.map(inv => inv.id === editingInvoice.id ? modifiedInvoice : inv);
        }
        return [modifiedInvoice, ...prev];
      });
    }
    setIsInvoiceModalOpen(false);
  };
    
  const handleDeleteInvoice = (id: string) => {
    const inv = allInvoices.find(i => i.id === id);
    if (inv?.source !== 'manual') {
      alert('Apenas faturas manuais podem ser excluídas por aqui.');
      return;
    }
    if (confirm('Excluir esta fatura manual?')) {
      setManualInvoices(prev => prev.filter(inv => inv.id !== id));
      setIsInvoiceModalOpen(false);
    }
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
        amount: 'R$ 0,00',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente'
      });
      setIsNewExpense(true);
    }
    setIsExpenseModalOpen(true);
  };
    
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
      
    const modifiedExpense = {
      ...editingExpense,
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário')
    };
      
    if (isNewExpense) {
      setExpenses(prev => [modifiedExpense, ...prev]);
    } else {
      setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? modifiedExpense : exp));
    }
    setIsExpenseModalOpen(false);
  };
    
  const handleDeleteExpense = (id: string) => {
    if (confirm('Excluir esta despesa?')) {
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      setIsExpenseModalOpen(false);
    }
  };
    
  const statusStyle: Record<string, string> = {
    Pago: 'bg-[#111111] text-[#B5FF03] font-black uppercase tracking-widest border border-[#B5FF03]',
    Pendente: 'bg-[#111111] text-[#888888] font-black uppercase tracking-widest border border-[#222222]',
    Vencida: 'bg-[#111111] text-[#ff4444] font-black uppercase tracking-widest border border-[#ff4444]/50',
    Cancelado: 'bg-[#111111] text-[#888888] font-black uppercase tracking-widest border border-[#222222]',
  };
    
  const categoryLabel = (cat: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
  };
    
  const toggleStatusFilter = (status: string) => {
    setFiltersState(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status]
    }));
  };
    
  const toggleCategoryFilter = (category: string) => {
    setFiltersState(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };
    
  const toggleOriginFilter = (origin: string) => {
    setFiltersState(prev => ({
      ...prev,
      origins: prev.origins.includes(origin)
        ? prev.origins.filter(o => o !== origin)
        : [...prev.origins, origin]
    }));
  };

  const filterContent = (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#B5FF03]">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#888888] hover:text-[#B5FF03] transition-colors flex items-center gap-1"
          >
            <XCircle size={12} />
            Limpar
          </button>
        )}
      </div>

      <FilterSection title="Período">
        <RadioFilter
          label="Este Mês"
          checked={filtersState.period === 'this_month'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'this_month' ? '' : 'this_month' }))}
        />
        <RadioFilter
          label="Mês Passado"
          checked={filtersState.period === 'last_month'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'last_month' ? '' : 'last_month' }))}
        />
        <RadioFilter
          label="Últimos 90 Dias"
          checked={filtersState.period === '90_days'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === '90_days' ? '' : '90_days' }))}
        />
      </FilterSection>

      <FilterSection title="Status">
        {(activeTab === 'receitas' ? INVOICE_STATUSES : EXPENSE_STATUSES).map(status => (
          <CheckboxFilter
            key={status}
            label={status}
            checked={filtersState.statuses.includes(status)}
            onChange={(checked) => {
              if (checked) {
                setFiltersState(prev => ({ ...prev, statuses: [...prev.statuses, status] }));
              } else {
                setFiltersState(prev => ({ ...prev, statuses: prev.statuses.filter(s => s !== status) }));
              }
            }}
          />
        ))}
      </FilterSection>

      {activeTab === 'receitas' && (
        <FilterSection title="Forma de Pagamento">
          {PAYMENT_METHODS.map(pm => (
            <CheckboxFilter
              key={pm.value}
              label={pm.label}
              checked={filtersState.origins.includes(pm.value)}
              onChange={(checked) => {
                if (checked) {
                  setFiltersState(prev => ({ ...prev, origins: [...prev.origins, pm.value] }));
                } else {
                  setFiltersState(prev => ({ ...prev, origins: prev.origins.filter(o => o !== pm.value) }));
                }
              }}
            />
          ))}
        </FilterSection>
      )}

      {activeTab === 'fluxo' && (
        <FilterSection title="Categorias">
          {EXPENSE_CATEGORIES.map(cat => (
            <CheckboxFilter
              key={cat.value}
              label={cat.label}
              checked={filtersState.categories.includes(cat.value)}
              onChange={(checked) => {
                if (checked) {
                  setFiltersState(prev => ({ ...prev, categories: [...prev.categories, cat.value] }));
                } else {
                  setFiltersState(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat.value) }));
                }
              }}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title="Valor">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#888888] uppercase tracking-widest">Mínimo (R$)</label>
            <input
              type="number"
              value={filtersState.minValue}
              onChange={(e) => setFiltersState(prev => ({ ...prev, minValue: e.target.value }))}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#888888] uppercase tracking-widest">Máximo (R$)</label>
            <input
              type="number"
              value={filtersState.maxValue}
              onChange={(e) => setFiltersState(prev => ({ ...prev, maxValue: e.target.value }))}
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
            <button
              onClick={() => handleOpenInvoiceModal()}
              className="rounded-full px-3 py-1.5 min-w-[120px] bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest hover:bg-[#a5ef03] transition-colors"
            >
              CRIAR FATURA
            </button>
            <button
              onClick={() => handleOpenExpenseModal()}
              className="rounded-full px-3 py-1.5 min-w-[120px] bg-[#111111] text-white font-bold text-xs uppercase tracking-widest border border-[#222222] hover:border-[#B5FF03] transition-colors"
            >
              CRIAR DESPESA
            </button>
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

      {/* KPI Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#888888]">Total Receitas</span>
            <TrendingUp size={16} className="text-[#B5FF03]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedTotalRevenue)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#888888]">Receitas Pendentes</span>
            <Clock size={16} className="text-[#888888]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedPendingRevenue)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#888888]">Total Despesas</span>
            <TrendingDown size={16} className="text-[#ff4444]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedTotalExpenses)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#888888]">Despesas Pendentes</span>
            <AlertTriangle size={16} className="text-[#ff4444]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedPendingExpenses)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-[#222222]">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('receitas')}
            className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
              activeTab === 'receitas'
                ? 'border-[#B5FF03] text-[#B5FF03]'
                : 'border-transparent text-[#888888] hover:text-white'
            }`}
          >
            Receitas ({filteredInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('fluxo')}
            className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors ${
              activeTab === 'fluxo'
                ? 'border-[#B5FF03] text-[#B5FF03]'
                : 'border-transparent text-[#888888] hover:text-white'
            }`}
          >
            Fluxo de Caixa ({filteredExpenses.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative">
        <div className="flex-1 p-6">
          {activeTab === 'receitas' ? (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">ID</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cliente</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Pagamento</th>
                    <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-[#888888]">{invoice.id}</td>
                      <td className="p-4 text-sm text-white">{invoice.client}</td>
                      <td className="p-4 text-sm text-white">{invoice.amount}</td>
                      <td className="p-4 text-sm text-[#888888]">{invoice.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#888888]">{paymentMethodLabel(invoice.paymentMethod)}</td>
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
                      <td colSpan={7} className="p-8 text-center text-sm text-[#888888]">
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
                    <div><span className="text-neutral-500">ID:</span> <span className="text-white">{invoice.id}</span></div>
                    <div><span className="text-neutral-500">Valor:</span> <span className="text-white">{invoice.amount}</span></div>
                    <div><span className="text-neutral-500">Data:</span> <span className="text-white">{invoice.date}</span></div>
                    <div><span className="text-neutral-500">Pagamento:</span> <span className="text-white">{paymentMethodLabel(invoice.paymentMethod)}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => handleOpenInvoiceModal(invoice)} className="text-[#B5FF03] p-2 min-h-[44px]"><Pencil size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredInvoices.length === 0 && (
                <p className="text-center text-sm text-[#888888] py-8">Nenhuma fatura encontrada</p>
              )}
            </div>
            </>
          ) : (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222222]">
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Categoria</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Descrição</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Valor</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data</th>
                    <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Status</th>
                    <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-4 text-sm text-[#888888]">{categoryLabel(expense.category)}</td>
                      <td className="p-4 text-sm text-white">{expense.description}</td>
                      <td className="p-4 text-sm text-white">{expense.amount}</td>
                      <td className="p-4 text-sm text-[#888888]">{expense.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[expense.status]}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenExpenseModal(expense)}
                          className="text-[#B5FF03] hover:text-white transition-colors mr-3"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-[#ff4444] hover:text-white transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[#888888]">
                        Nenhuma despesa encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile card view - Fluxo */}
            <div className="md:hidden space-y-3">
              {filteredExpenses.map(expense => (
                <div key={expense.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm">{expense.description}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusStyle[expense.status]}`}>{expense.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-neutral-500">Categoria:</span> <span className="text-white">{categoryLabel(expense.category)}</span></div>
                    <div><span className="text-neutral-500">Valor:</span> <span className="text-white">{expense.amount}</span></div>
                    <div><span className="text-neutral-500">Data:</span> <span className="text-white">{expense.date}</span></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
                    <button onClick={() => handleOpenExpenseModal(expense)} className="text-[#B5FF03] p-2 min-h-[44px]"><Pencil size={18} /></button>
                    <button onClick={() => handleDeleteExpense(expense.id)} className="text-[#ff4444] p-2 min-h-[44px]"><X size={18} /></button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <p className="text-center text-sm text-[#888888] py-8">Nenhuma despesa encontrada</p>
              )}
            </div>
            </>
          )}
        </div>
        
        {/* Filter Sidebar */}
        {isSidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0a0a0a] border-t border-[#222] rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto md:hidden">
              {filterContent}
            </div>
            <div className="hidden md:block w-64 bg-[#0a0a0a] border-l border-[#222222] p-4 overflow-y-auto max-h-screen sticky top-0">
              {filterContent}
            </div>
          </>
        )}
      </div>

      {/* Invoice Modal */}
      {isInvoiceModalOpen && editingInvoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-full md:max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                {isNewInvoice ? 'Nova Fatura' : 'Editar Fatura'}
              </h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-[#888888] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Cliente</label>
                <input
                  type="text"
                  value={editingInvoice.client}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, client: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Valor (R$)</label>
                <input
                  type="text"
                  value={editingInvoice.amount}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Data</label>
                <input
                  type="date"
                  value={editingInvoice.date}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Status</label>
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
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Forma de Pagamento</label>
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
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Qtd. Parcelas</label>
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
                {!isNewInvoice && editingInvoice.source === 'manual' && (
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-full md:max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                {isNewExpense ? 'Nova Despesa' : 'Editar Despesa'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#888888] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Categoria</label>
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
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Descrição</label>
                <input
                  type="text"
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Valor (R$)</label>
                <input
                  type="text"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Data</label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#888888] mb-2">Status</label>
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
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(editingExpense.id)}
                  className="rounded-full px-3 py-1.5 min-w-[120px] min-h-[44px] bg-[#111111] text-[#ff4444] font-bold text-xs uppercase tracking-widest border border-[#ff4444]/50 hover:border-[#ff4444] transition-colors"
                >
                  EXCLUIR
                </button>
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
