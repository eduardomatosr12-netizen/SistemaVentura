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
  status: 'Pago' | 'Pendente' | 'Cancelado' | 'Vencida';
  source?: 'manual' | 'lead' | 'asaas';
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

const ORIGINS = [
  { value: 'asaas', label: 'Asaas' },
  { value: 'manual', label: 'Manual' },
  { value: 'lead', label: 'Lead Convertido' },
];

const INVOICE_STATUSES = ['Pago', 'Pendente', 'Vencida', 'Cancelado'];
const EXPENSE_STATUSES = ['Pago', 'Pendente', 'Cancelado'];

  const FilterSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className="border-b border-neutral-100 pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)} 
          className="flex items-center justify-between w-full text-left py-1"
        >
          <span className="text-[10px] font-black text-black uppercase tracking-widest pl-1">{title}</span>
          {isOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
        </button>
        {isOpen && <div className="mt-3 space-y-2.5 pl-1">{children}</div>}
      </div>
    );
  };

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1">
    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${checked ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black'}`}>
      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className={`text-xs font-medium ${checked ? 'text-black' : 'text-neutral-500'}`}>{label}</span>
  </label>
);

const RadioFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2.5 cursor-pointer group pl-1">
    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${checked ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black'}`}>
      {checked && <div className="w-2 h-2 bg-white rounded-full" />}
    </div>
    <input type="radio" className="hidden" checked={checked} onChange={onChange} />
    <span className={`text-xs font-medium ${checked ? 'text-black' : 'text-neutral-500'}`}>{label}</span>
  </label>
);

const Financeiro = () => {
  const { leads, getTotalValueByStage } = useCRM();
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

  const parseBRL = (val: string) => {
    if (!val) return 0;
    const clean = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
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
      { id: 'PAY-827364', client: 'Clínica Sorriso', amount: 'R$ 15.000,00', date: '2026-04-20', status: 'Pago', source: 'asaas' },
      { id: 'PAY-918273', client: 'João Silva', amount: 'R$ 5.000,00', date: '2026-04-21', status: 'Pago', source: 'asaas' },
      { id: 'PAY-102938', client: 'Maria Santos', amount: 'R$ 8.000,00', date: '2026-04-25', status: 'Pendente', source: 'asaas' },
      { id: 'PAY-445566', client: 'Pedro Oliveira', amount: 'R$ 12.000,00', date: '2026-04-15', status: 'Vencida', source: 'asaas' },
      { id: 'PAY-778899', client: 'Odonto Master', amount: 'R$ 22.500,00', date: '2026-04-18', status: 'Pago', source: 'asaas' },
    ];

    setAsaasInvoices(mockAsaas);
    setLastSync(new Date().toLocaleTimeString());
    setIsSyncing(false);
  }, []);

  const computedLeadInvoices: Invoice[] = (leads || [])
    .filter(l => l.stage === 'Contrato Fechado')
    .map(l => ({
      id: `lead-${l.id}`,
      client: l.name,
      amount: l.value || 'R$ 0,00',
      date: l.closingDate || '—',
      status: 'Pago',
      source: 'lead'
    }));

  const allInvoices = useMemo(() => 
    [...asaasInvoices, ...manualInvoices, ...computedLeadInvoices].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [asaasInvoices, manualInvoices, leads]);

  const filteredInvoices = useMemo(() => {
    let result = allInvoices || [];

    if (filtersState.statuses?.length > 0) {
      result = result.filter(inv => filtersState.statuses.includes(inv.status));
    }

    if (filtersState.origins?.length > 0) {
      result = result.filter(inv => {
        const source = inv.source || 'manual';
        return filtersState.origins.includes(source);
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
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário')
    };

    if (isNewInvoice) {
      setManualInvoices(prev => [modifiedInvoice, ...prev]);
    } else {
      if (editingInvoice.source === 'lead') {
        alert('Faturas vinculadas a leads devem ser editadas no módulo de Leads.');
      } else if (editingInvoice.source === 'asaas') {
        alert('Faturas do Asaas são sincronizadas automaticamente e não podem ser editadas manualmente.');
      } else {
        setManualInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? modifiedInvoice : inv));
      }
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
    Pago: 'bg-emerald-50 text-emerald-700 font-black uppercase tracking-widest',
    Pendente: 'bg-amber-50 text-amber-600 font-black uppercase tracking-widest',
    Vencida: 'bg-red-50 text-red-600 font-black uppercase tracking-widest',
    Cancelado: 'bg-neutral-50 text-neutral-300 font-black uppercase tracking-widest',
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

  return (
    <div className="relative min-h-screen">
       {isSidebarOpen && (
         <>
           <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />
           <div className="absolute top-14 left-4 w-[320px] max-h-[70vh] bg-white border border-neutral-200 rounded-xl shadow-xl overflow-y-auto z-50">
             <div className="px-5 py-3 sticky top-0 bg-white border-b border-neutral-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Filter size={12} className="text-black" />
                 <span className="text-[10px] font-black text-black uppercase tracking-widest">Filtros</span>
               </div>
               <button 
                 onClick={() => setIsSidebarOpen(false)}
                 className="p-1 hover:bg-neutral-100 rounded-md transition-colors"
               >
                 <X size={14} className="text-neutral-400" />
               </button>
             </div>
             {hasActiveFilters && (
                <button 
                  onClick={clearFilters}
                  className="text-[10px] font-bold text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1 px-5 py-2 border-b border-neutral-100 w-full"
                >
                  <XCircle size={10} />
                  Limpar filtros
                </button>
             )}

             <div className="px-5 py-4 max-w-[300px] mx-auto">
             <FilterSection title="Período">
              <div className="space-y-2">
                {[
                  { value: '', label: 'Todos os períodos' },
                  { value: 'this_month', label: 'Este mês' },
                  { value: 'last_month', label: 'Mês passado' },
                  { value: '90_days', label: 'Últimos 90 dias' },
                  { value: 'custom', label: 'Personalizado' },
                ].map(opt => (
                  <RadioFilter
                    key={opt.value}
                    label={opt.label}
                    checked={filtersState.period === opt.value}
                    onChange={() => setFiltersState(prev => ({ ...prev, period: opt.value as any }))}
                  />
                ))}
              </div>
              {filtersState.period === 'custom' && (
                 <div className="space-y-3 mt-3 pt-3 border-t border-neutral-100">
                   <input
                     type="date"
                     value={filtersState.customDateStart}
                     onChange={(e) => setFiltersState(prev => ({ ...prev, customDateStart: e.target.value }))}
                     className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-xs font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                     placeholder="Data inicial"
                   />
                   <input
                     type="date"
                     value={filtersState.customDateEnd}
                     onChange={(e) => setFiltersState(prev => ({ ...prev, customDateEnd: e.target.value }))}
                     className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-xs font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                     placeholder="Data final"
                   />
                 </div>
               )}
            </FilterSection>

            <FilterSection title="Status">
              {(activeTab === 'receitas' ? INVOICE_STATUSES : EXPENSE_STATUSES).map(status => (
                <CheckboxFilter
                  key={status}
                  label={status}
                  checked={filtersState.statuses.includes(status)}
                  onChange={() => toggleStatusFilter(status)}
                />
              ))}
            </FilterSection>

            {activeTab === 'receitas' && (
              <FilterSection title="Origem">
                {ORIGINS.map(origin => (
                  <CheckboxFilter
                    key={origin.value}
                    label={origin.label}
                    checked={filtersState.origins.includes(origin.value)}
                    onChange={() => toggleOriginFilter(origin.value)}
                  />
                ))}
              </FilterSection>
            )}

            {activeTab === 'fluxo' && (
              <FilterSection title="Categoria">
                {EXPENSE_CATEGORIES.map(cat => (
                  <CheckboxFilter
                    key={cat.value}
                    label={cat.label}
                    checked={filtersState.categories.includes(cat.value)}
                    onChange={() => toggleCategoryFilter(cat.value)}
                  />
                ))}
              </FilterSection>
            )}

            <FilterSection title="Faixa de Valor">
               <div className="space-y-3">
                 <input
                   type="number"
                   value={filtersState.minValue}
                   onChange={(e) => setFiltersState(prev => ({ ...prev, minValue: e.target.value }))}
                   className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-xs font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                   placeholder="Mínimo (R$)"
                 />
                 <input
                   type="number"
                   value={filtersState.maxValue}
                   onChange={(e) => setFiltersState(prev => ({ ...prev, maxValue: e.target.value }))}
                   className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-xs font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                   placeholder="Máximo (R$)"
                 />
               </div>
             </FilterSection>
             </div>
           </div>
        </>
      )}

      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters ? 'bg-neutral-100 text-black border-neutral-200' : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
              >
                <SlidersHorizontal size={16} strokeWidth={hasActiveFilters ? 2.5 : 1.5} />
                {hasActiveFilters && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Filtros
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 md:gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight">Financeiro</h1>
                {isAsaasConnected && (
                  <span className="flex items-center gap-1 px-2 md:px-2.5 py-0.5 md:py-1 bg-emerald-50 text-emerald-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full animate-in fade-in slide-in-from-left-2 duration-500">
                    <CheckCircle2 size={10} strokeWidth={3} />
                    <span className="hidden sm:inline">Asaas Conectado</span>
                    <span className="sm:hidden">Conectado</span>
                  </span>
                )}
              </div>
              <p className="text-neutral-500 text-xs md:text-sm font-medium">
                {hasActiveFilters 
                  ? `${filteredInvoices.length + filteredExpenses.length} registro(s) filtrado(s)` 
                  : 'Controle de receitas, despesas e fluxo de caixa.'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full sm:w-auto">
            {isAsaasConnected && (
              <button 
                onClick={syncAsaasData}
                disabled={isSyncing}
                className="flex-1 sm:flex-none px-3 md:px-4 py-2 md:py-3 rounded-md border border-neutral-200 text-neutral-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black hover:text-black transition-all active:scale-[0.98] bg-white"
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Atualizar'}</span>
                <span className="sm:hidden">{isSyncing ? 'Sync...' : 'Atualizar'}</span>
              </button>
            )}
            <button 
              onClick={() => activeTab === 'receitas' ? handleOpenInvoiceModal() : handleOpenExpenseModal()}
              className="flex-1 sm:flex-none bg-black text-white px-3 md:px-6 py-2 md:py-3 rounded-md font-black text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-sm"
            >
              <Plus size={14} strokeWidth={3} />
              <span className="hidden sm:inline">{activeTab === 'receitas' ? 'Nova Fatura' : 'Nova Despesa'}</span>
              <span className="sm:hidden">{activeTab === 'receitas' ? 'Fatura' : 'Despesa'}</span>
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('receitas')}
            className={`flex items-center gap-2 px-4 md:px-6 py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'receitas' 
                ? 'border-black text-black' 
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <Receipt size={14} strokeWidth={2} />
            Receitas de Clientes
          </button>
          <button
            onClick={() => setActiveTab('fluxo')}
            className={`flex items-center gap-2 px-4 md:px-6 py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'fluxo' 
                ? 'border-black text-black' 
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <Wallet size={14} strokeWidth={2} />
            Fluxo Interno
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4 mb-6 md:mb-10">
          {[
            { key: 'revenue', label: 'Receita Total', value: computedTotalRevenue, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { key: 'expenses', label: 'Despesas', value: computedTotalExpenses, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
            { key: 'profit', label: 'Lucro Líquido', value: computedNetProfit, icon: PieChart, color: 'text-black', bg: 'bg-neutral-100' },
            { key: 'pending', label: activeTab === 'receitas' ? 'Faturamento Pendente' : 'Despesas Pendentes', value: activeTab === 'receitas' ? computedPendingRevenue : computedPendingExpenses, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((card) => (
            <div 
              key={card.key}
              className="bg-white border border-neutral-200 rounded-2xl p-3 md:p-6 shadow-sm"
            >
              <div className="flex justify-between items-start gap-2 mb-2 md:mb-4">
                <div className={`w-8 md:w-10 h-8 md:h-10 ${card.bg} rounded-md flex items-center justify-center ${card.color}`}>
                  <card.icon size={12} className="md:w-4.5 md:h-4.5 md:size-4.5" strokeWidth={2.5} />
                </div>
                <span className="text-[8px] text-neutral-400 font-bold" title="Cálculo automático">(auto)</span>
              </div>
              <p className="text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-widest mb-1">{card.label}</p>
              <p 
                className={`text-xl md:text-2xl font-black tracking-tight ${card.value < 0 ? 'text-red-600' : 'text-black'}`}
              >
                {formatCurrency(card.value)}
              </p>
            </div>
          ))}
        </div>

        {activeTab === 'receitas' ? (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-x-auto shadow-sm">
            <div className="px-3 md:px-8 py-3 md:py-5 border-b border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-50/30">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 md:w-8 h-6 md:h-8 rounded-md bg-white shadow-sm border border-neutral-100 flex items-center justify-center">
                  <CreditCard size={12} className="md:w-3.5 md:h-3.5 text-black" />
                </div>
                <div>
                  <h2 className="text-[10px] md:text-[11px] font-black text-black uppercase tracking-widest">Faturas Recentes</h2>
                  {lastSync && <p className="text-[8px] md:text-[9px] text-neutral-400 font-bold uppercase tracking-tighter mt-0.5">Última sincronização: {lastSync}</p>}
                </div>
              </div>
              {isAsaasConnected && (
                <div className="flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-white border border-neutral-200 rounded-md shadow-xs whitespace-nowrap">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[8px] md:text-[9px] font-black text-black uppercase tracking-widest">Live: Asaas</span>
                </div>
              )}
            </div>
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-3 md:px-8 py-2 md:py-4 text-left text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Cliente</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-left text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Data</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-right text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Valor</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-center text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Status</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-center text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider whitespace-nowrap">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredInvoices.map((invoice) => (
                  <tr 
                    key={invoice.id} 
                    onClick={() => handleOpenInvoiceModal(invoice)}
                    className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-3 md:px-8 py-3 md:py-5">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className={`w-6 md:w-8 h-6 md:h-8 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black uppercase transition-all flex-shrink-0 ${
                          invoice.source === 'asaas' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400 group-hover:bg-black group-hover:text-white'
                        }`}>
                          {invoice.client.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-black text-black text-xs md:text-sm group-hover:underline">{invoice.client}</p>
                          <p className="text-[9px] md:text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">ID: {invoice.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-neutral-500 font-bold text-xs md:text-sm">{invoice.date}</td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-right font-black text-black text-xs md:text-sm whitespace-nowrap">{invoice.amount}</td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-center">
                      <span className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-md text-[8px] md:text-[9px] ${statusStyle[invoice.status]}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-center">
                      {invoice.source === 'asaas' ? (
                        <div className="flex items-center justify-center" title="Asaas Gateway">
                          <ExternalLink size={12} className="md:w-3.5 md:h-3.5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center" title="Sistema Interno">
                          <Save size={12} className="md:w-3.5 md:h-3.5 text-neutral-300" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 md:px-8 py-8 md:py-12 text-center text-neutral-400 font-bold uppercase tracking-widest italic opacity-50 text-xs md:text-sm">
                      Nenhuma fatura encontrada com os filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-x-auto shadow-sm">
            <div className="px-3 md:px-8 py-3 md:py-5 border-b border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-50/30">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 md:w-8 h-6 md:h-8 rounded-md bg-white shadow-sm border border-neutral-100 flex items-center justify-center">
                  <Wallet size={12} className="md:w-3.5 md:h-3.5 text-black" />
                </div>
                <div>
                  <h2 className="text-[10px] md:text-[11px] font-black text-black uppercase tracking-widest">Despesas Operacionais</h2>
                  <p className="text-[8px] md:text-[9px] text-neutral-400 font-bold uppercase tracking-tighter mt-0.5">{filteredExpenses.length} registro(s)</p>
                </div>
              </div>
            </div>
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-3 md:px-8 py-2 md:py-4 text-left text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Data</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-left text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Categoria</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-left text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Descrição</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-right text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Valor</th>
                  <th className="px-3 md:px-8 py-2 md:py-4 text-center text-[9px] md:text-[10px] text-neutral-400 font-black uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredExpenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    onClick={() => handleOpenExpenseModal(expense)}
                    className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-3 md:px-8 py-3 md:py-5 text-neutral-500 font-bold text-xs md:text-sm">{expense.date}</td>
                    <td className="px-3 md:px-8 py-3 md:py-5">
                      <span className="inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-md text-[8px] md:text-[9px] bg-neutral-100 text-neutral-700 font-black uppercase tracking-widest">
                        {categoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5">
                      <p className="font-black text-black text-xs md:text-sm">{expense.description}</p>
                      <p className="text-[9px] md:text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">ID: {expense.id}</p>
                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-right font-black text-black text-xs md:text-sm whitespace-nowrap">{expense.amount}</td>
                    <td className="px-3 md:px-8 py-3 md:py-5 text-center">
                      <span className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-md text-[8px] md:text-[9px] ${statusStyle[expense.status]}`}>
                        {expense.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 md:px-8 py-8 md:py-12 text-center text-neutral-400 font-bold uppercase tracking-widest italic opacity-50 text-xs md:text-sm">
                      Nenhuma despesa encontrada com os filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isInvoiceModalOpen && editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={handleSaveInvoice}>
              <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-black tracking-tight">
                  {isNewInvoice ? 'Nova Fatura Manual' : 'Editar Fatura'}
                </h3>
                <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="text-neutral-400 hover:text-black transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <User size={12} strokeWidth={3} />
                    Cliente / Descrição
                  </label>
                  <input
                    required
                    disabled={editingInvoice.source === 'asaas'}
                    type="text"
                    value={editingInvoice.client}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, client: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      <Calendar size={12} strokeWidth={3} />
                      Data
                    </label>
                    <input
                      required
                      disabled={editingInvoice.source === 'asaas'}
                      type="date"
                      value={editingInvoice.date}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all [color-scheme:light] disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      <DollarSign size={12} strokeWidth={3} />
                      Valor
                    </label>
                    <input
                      required
                      disabled={editingInvoice.source === 'asaas'}
                      type="text"
                      value={editingInvoice.amount}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <CheckCircle2 size={12} strokeWidth={3} />
                    Status
                  </label>
                  <select
                    disabled={editingInvoice.source === 'asaas'}
                    value={editingInvoice.status}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Vencida">Vencida</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                {editingInvoice.source === 'asaas' && (
                  <div className="p-4 bg-emerald-50 rounded-2xl flex gap-3 items-center">
                    <AlertTriangle size={16} className="text-emerald-600" />
                    <p className="text-[10px] text-emerald-700 font-bold leading-tight">
                      Esta fatura é gerenciada pelo Asaas. Alterações devem ser feitas diretamente no painel do gateway.
                    </p>
                  </div>
                )}
              </div>
              <div className="px-8 py-6 bg-neutral-50 flex justify-between gap-3">
                <div className="flex gap-3">
                  {!isNewInvoice && editingInvoice.source === 'manual' && (
                    <button 
                      type="button"
                      onClick={() => handleDeleteInvoice(editingInvoice.id)}
                      className="px-4 py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  )}
                </div>
                <div className="flex gap-3 flex-1">
                  <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="flex-1 py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest text-neutral-400">Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={editingInvoice.source === 'asaas'}
                    className="flex-[2] bg-black text-white py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isNewInvoice ? 'Criar Fatura' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isExpenseModalOpen && editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={handleSaveExpense}>
              <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-black tracking-tight">
                  {isNewExpense ? 'Nova Despesa' : 'Editar Despesa'}
                </h3>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="text-neutral-400 hover:text-black transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      <Calendar size={12} strokeWidth={3} />
                      Data
                    </label>
                    <input
                      required
                      type="date"
                      value={editingExpense.date}
                      onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all [color-scheme:light]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      <DollarSign size={12} strokeWidth={3} />
                      Valor
                    </label>
                    <input
                      required
                      type="text"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <Receipt size={12} strokeWidth={3} />
                    Categoria
                  </label>
                  <select
                    value={editingExpense.category}
                    onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all appearance-none cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <Pencil size={12} strokeWidth={3} />
                    Descrição
                  </label>
                  <input
                    required
                    type="text"
                    value={editingExpense.description}
                    onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <CheckCircle2 size={12} strokeWidth={3} />
                    Status
                  </label>
                  <select
                    value={editingExpense.status}
                    onChange={(e) => setEditingExpense({ ...editingExpense, status: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="px-8 py-6 bg-neutral-50 flex justify-between gap-3">
                <div className="flex gap-3">
                  {!isNewExpense && (
                    <button 
                      type="button"
                      onClick={() => handleDeleteExpense(editingExpense.id)}
                      className="px-4 py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  )}
                </div>
                <div className="flex gap-3 flex-1">
                  <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest text-neutral-400">Cancelar</button>
                  <button 
                    type="submit" 
                    className="flex-[2] bg-black text-white py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-neutral-800 transition-all active:scale-[0.98]"
                  >
                    {isNewExpense ? 'Criar Despesa' : 'Salvar Alterações'}
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

export default Financeiro;