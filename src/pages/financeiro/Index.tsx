import { useState, useMemo, useCallback } from 'react';
import { useCRM } from '../../contexts/CRMContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { generateUUID } from '../../lib/uuid';
import { Pencil, X, TrendingUp, TrendingDown, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

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
  const { Orçamentos } = useCRM();
  const { role, employeeName } = useAuth();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();

  const [activeTab, setActiveTab] = useState<'receitas' | 'fluxo' | 'projecao'>('receitas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [filtersState, setFiltersState] = useState({
    period: '' as '' | 'today' | 'this_week' | 'this_month' | 'last_month' | '90_days' | 'this_year' | 'custom',
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
    
  const getDateRange = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filtersState.period === 'today') {
      return { start: today, end: today };
    } else if (filtersState.period === 'this_week') {
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      const end = new Date(today);
      end.setDate(start.getDate() + 6);
      return { start, end };
    } else if (filtersState.period === 'this_month') {
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
    } else if (filtersState.period === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    } else if (filtersState.period === 'custom' && filtersState.customDateStart && filtersState.customDateEnd) {
      return { 
        start: new Date(filtersState.customDateStart), 
        end: new Date(filtersState.customDateEnd) 
      };
    }
    return null;
  }, [filtersState]);

  const isInDateRange = useCallback((dateStr: string) => {
    if (!dateStr || dateStr === '—') return true;
    const range = getDateRange();
    if (!range) return true;
    const date = new Date(dateStr);
    return date >= range.start && date <= range.end;
  }, [getDateRange]);
    
  const firebaseInvoices: Invoice[] = useMemo(() =>
    (transactions || [])
      .filter(t => t.type === 'receita' && t.source !== 'lead')
      .map(t => ({
        id: t.id!,
        client: t.client || '',
        amount: formatCurrency(t.amount),
        date: t.date,
        status: t.status,
        source: (t.source === 'asaas' ? 'asaas' : 'manual') as 'manual' | 'asaas',
        paymentMethod: t.paymentMethod,
        installments: t.installments,
        lastModifiedBy: t.lastModifiedBy,
      })),
  [transactions]);

  const [asaasInvoices] = useState<Invoice[]>([]);
    
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
    [...asaasInvoices, ...firebaseInvoices, ...computedLeadInvoices].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [asaasInvoices, firebaseInvoices, computedLeadInvoices]);

  const filteredInvoices = useMemo(() => {
    let result = allInvoices || [];
      
    if (filtersState.statuses?.length > 0) {
      const selectedLower = filtersState.statuses.map(s => s.toLowerCase());
      result = result.filter(inv => selectedLower.includes(inv.status.toLowerCase()));
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
  }, [allInvoices, filtersState, isInDateRange]);

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
        lastModifiedBy: t.lastModifiedBy,
      })),
  [transactions]);
    
  const filteredExpenses = useMemo(() => {
    let result = firebaseExpenses || [];
      
    if (activeTab === 'fluxo' && filtersState.categories?.length > 0) {
      result = result.filter(exp => filtersState.categories.includes(exp.category));
    }
      
    if (filtersState.statuses?.length > 0) {
      const selectedLower = filtersState.statuses.map(s => s.toLowerCase());
      result = result.filter(exp => selectedLower.includes(exp.status.toLowerCase()));
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
  }, [firebaseExpenses, filtersState, activeTab, isInDateRange]);
    
  const isPaid = (s: string) => s.toLowerCase() === 'pago';
  const isCancelled = (s: string) => s.toLowerCase() === 'cancelado';
  const isPending = (s: string) => s.toLowerCase() === 'pendente';

  const computedTotalRevenue = useMemo(() => 
    filteredInvoices
      .filter(inv => isPaid(inv.status))
      .reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
  [filteredInvoices]);
    
  const computedPendingRevenue = useMemo(() => 
    filteredInvoices
      .filter(inv => !isPaid(inv.status) && !isCancelled(inv.status))
      .reduce((acc, inv) => acc + parseBRL(inv.amount), 0),
  [filteredInvoices]);
    
  const computedTotalExpenses = useMemo(() => 
    filteredExpenses
      .filter(exp => isPaid(exp.status))
      .reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
  [filteredExpenses]);
    
  const computedPendingExpenses = useMemo(() => 
    filteredExpenses
      .filter(exp => isPending(exp.status))
      .reduce((acc, exp) => acc + parseBRL(exp.amount), 0),
  [filteredExpenses]);
    
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
    
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isNewInvoice, setIsNewInvoice] = useState(false);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isNewExpense, setIsNewExpense] = useState(false);
    
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
    if (confirm('Excluir esta fatura?')) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('[Finance] Erro ao excluir fatura:', err);
      }
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
        amount: '0,00',
        date: new Date().toISOString().split('T')[0],
        status: 'Pendente'
      });
      setIsNewExpense(true);
    }
    setIsExpenseModalOpen(true);
  };
    
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    const amountValue = parseBRL(editingExpense.amount);
      
    if (isNewExpense) {
      try {
        await addTransaction({
          type: 'despesa',
          description: editingExpense.description,
          category: editingExpense.category,
          amount: amountValue,
          date: editingExpense.date,
          status: editingExpense.status,
          source: 'manual',
          lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
        });
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
          lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
        });
      } catch (err) {
        console.error('[Finance] Erro ao atualizar despesa:', err);
      }
    }
    setIsExpenseModalOpen(false);
  };
    
  const handleDeleteExpense = async (id: string) => {
    if (confirm('Excluir esta despesa?')) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('[Finance] Erro ao excluir despesa:', err);
      }
      setIsExpenseModalOpen(false);
    }
  };
    
  const statusStyle: Record<string, string> = {
    Pago: 'bg-[#111111] text-[#B5FF03] font-black uppercase tracking-widest border border-[#B5FF03]',
    Pendente: 'bg-[#111111] text-[#aaaaaa] font-black uppercase tracking-widest border border-[#222222]',
    Vencida: 'bg-[#111111] text-[#ff4444] font-black uppercase tracking-widest border border-[#ff4444]/50',
    Cancelado: 'bg-[#111111] text-[#aaaaaa] font-black uppercase tracking-widest border border-[#222222]',
  };
    
  const categoryLabel = (cat: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
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
          checked={filtersState.period === 'today'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'today' ? '' : 'today' }))}
        />
        <RadioFilter
          label="Esta Semana"
          checked={filtersState.period === 'this_week'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'this_week' ? '' : 'this_week' }))}
        />
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
        <RadioFilter
          label="Este Ano"
          checked={filtersState.period === 'this_year'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'this_year' ? '' : 'this_year' }))}
        />
        <RadioFilter
          label="Personalizado"
          checked={filtersState.period === 'custom'}
          onChange={() => setFiltersState(prev => ({ ...prev, period: prev.period === 'custom' ? '' : 'custom' }))}
        />
        {filtersState.period === 'custom' && (
          <div className="space-y-3 pt-2 pl-1">
            <div>
              <label className="text-xs text-[#aaaaaa] uppercase tracking-widest mb-1 block">De:</label>
              <input
                type="date"
                value={filtersState.customDateStart}
                onChange={(e) => setFiltersState(prev => ({ ...prev, customDateStart: e.target.value }))}
                className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#aaaaaa] uppercase tracking-widest mb-1 block">Até:</label>
              <input
                type="date"
                value={filtersState.customDateEnd}
                onChange={(e) => setFiltersState(prev => ({ ...prev, customDateEnd: e.target.value }))}
                className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
              />
            </div>
          </div>
        )}
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
            <label className="text-xs text-[#aaaaaa] uppercase tracking-widest">Mínimo (R$)</label>
            <input
              type="number"
              value={filtersState.minValue}
              onChange={(e) => setFiltersState(prev => ({ ...prev, minValue: e.target.value }))}
              className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#aaaaaa] uppercase tracking-widest">Máximo (R$)</label>
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
            <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Total Receitas</span>
            <TrendingUp size={16} className="text-[#B5FF03]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedTotalRevenue)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Receitas Pendentes</span>
            <Clock size={16} className="text-[#aaaaaa]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedPendingRevenue)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Total Despesas</span>
            <TrendingDown size={16} className="text-[#ff4444]" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(computedTotalExpenses)}</p>
        </div>
        <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#aaaaaa]">Despesas Pendentes</span>
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
            Fluxo de Caixa ({filteredExpenses.length})
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
      </div>

      {/* Main Content */}
      <div className="flex relative">
        <div className="flex-1 p-6">
          {activeTab === 'receitas' && (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
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
                      <td className="p-4 text-sm text-[#aaaaaa]">{invoice.id}</td>
                      <td className="p-4 text-sm text-white">{invoice.client}</td>
                      <td className="p-4 text-sm text-white">{invoice.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{invoice.date}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusStyle[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{paymentMethodLabel(invoice.paymentMethod, invoice.installments)}</td>
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
                      <td colSpan={7} className="p-8 text-center text-sm text-[#aaaaaa]">
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
          {activeTab === 'fluxo' && (
            <>
            <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
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
                      <td className="p-4 text-sm text-[#aaaaaa]">{categoryLabel(expense.category)}</td>
                      <td className="p-4 text-sm text-white">{expense.description}</td>
                      <td className="p-4 text-sm text-white">{expense.amount}</td>
                      <td className="p-4 text-sm text-[#aaaaaa]">{expense.date}</td>
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
                      <td colSpan={6} className="p-8 text-center text-sm text-[#aaaaaa]">
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
                <p className="text-center text-sm text-[#aaaaaa] py-8">Nenhuma despesa encontrada</p>
              )}
            </div>
            </>
          )}
          {activeTab === 'projecao' && (
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
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg w-full max-w-full md:max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                {isNewExpense ? 'Nova Despesa' : 'Editar Despesa'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#aaaaaa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-4">
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
                <label className="block text-xs font-black uppercase tracking-widest text-[#aaaaaa] mb-2">Data</label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors"
                  required
                />
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
