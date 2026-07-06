import { useState, useEffect } from 'react';
import { Plus, Trash2, Lock, Check } from 'lucide-react';
import { generateUUID } from '../lib/uuid';
import { addTransaction, updateTransaction, deleteTransaction } from '../services/financeService';
import type { EventExpense } from '../types/crm';

const STORAGE_KEY = 'despesas_evento';

const CATEGORIES: EventExpense['category'][] = ['Transporte', 'Alimentação', 'Hospedagem', 'Material', 'Equipe', 'Outros'];
const PAYMENT_METHODS: { value: EventExpense['paymentMethod']; label: string }[] = [
  { value: 'Pix', label: 'Pix' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão', label: 'Cartão' },
  { value: 'Boleto', label: 'Boleto' },
];

function loadExpenses(eventId: string): EventExpense[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${eventId}`);
    if (raw) return JSON.parse(raw) as EventExpense[];
  } catch { /* ignore */ }
  return [];
}

function saveExpenses(eventId: string, expenses: EventExpense[]) {
  localStorage.setItem(`${STORAGE_KEY}_${eventId}`, JSON.stringify(expenses));
}

interface Props {
  eventId: string | null;
}

export default function DespesasDoEvento({ eventId }: Props) {
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState<EventExpense['category']>('Outros');
  const [formValor, setFormValor] = useState('');
  const [formStatus, setFormStatus] = useState<EventExpense['status']>('Pendente');
  const [formPayment, setFormPayment] = useState<EventExpense['paymentMethod'] | ''>('');

  useEffect(() => {
    if (eventId) {
      const local = loadExpenses(eventId);
      setExpenses(local);
      local.forEach(exp => {
        if (!exp.financeiroId) {
          syncExpenseToFirestore(eventId, exp).then(financeiroId => {
            if (financeiroId) {
              const updated = loadExpenses(eventId).map(e =>
                e.id === exp.id ? { ...e, financeiroId } : e
              );
              saveExpenses(eventId, updated);
              setExpenses(updated);
            }
          });
        }
      });
    }
  }, [eventId]);

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
        <Lock size={32} className="mb-3 text-neutral-600" />
        <p className="text-sm font-medium">Crie ou salve o evento primeiro</p>
        <p className="text-[10px] mt-1">As despesas internas ficam vinculadas ao ID do evento</p>
      </div>
    );
  }

  const syncExpenseToFirestore = async (evId: string, exp: EventExpense): Promise<string | null> => {
    try {
      const id = await addTransaction({
        type: 'despesa',
        description: exp.description,
        category: exp.category,
        amount: exp.valor,
        date: new Date().toISOString().split('T')[0],
        status: exp.status === 'Pago' ? 'Pago' : 'Pendente',
        paymentMethod: exp.paymentMethod,
        expenseType: 'variavel',
        source: 'evento',
        origemEventoId: evId,
      });
      return id;
    } catch (err) {
      console.error('[DespesasDoEvento] Erro ao sincronizar despesa:', err);
      return null;
    }
  };

  const resetForm = () => {
    setFormDesc('');
    setFormCat('Outros');
    setFormValor('');
    setFormStatus('Pendente');
    setFormPayment('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!formDesc.trim() || !formValor) return;
    const nova: EventExpense = {
      id: generateUUID(),
      description: formDesc.trim(),
      category: formCat,
      valor: parseFloat(formValor.replace(',', '.')) || 0,
      status: formStatus,
      paymentMethod: formPayment ? (formPayment as EventExpense['paymentMethod']) : undefined,
      tipo: 'variavel',
      interno: true,
    };

    const financeiroId = await syncExpenseToFirestore(eventId, nova);
    if (financeiroId) {
      nova.financeiroId = financeiroId;
    }

    const updated = [...expenses, nova];
    setExpenses(updated);
    saveExpenses(eventId, updated);
    resetForm();
  };

  const handleRemove = async (expId: string) => {
    const exp = expenses.find(e => e.id === expId);
    if (exp?.financeiroId) {
      try {
        await deleteTransaction(exp.financeiroId);
      } catch (err) {
        console.error('[DespesasDoEvento] Erro ao excluir transação:', err);
      }
    }
    const updated = expenses.filter(e => e.id !== expId);
    setExpenses(updated);
    saveExpenses(eventId, updated);
  };

  const toggleStatus = async (expId: string) => {
    const exp = expenses.find(e => e.id === expId);
    if (!exp) return;
    const novoStatus = exp.status === 'Pago' ? 'Pendente' as const : 'Pago' as const;
    if (exp.financeiroId) {
      try {
        await updateTransaction(exp.financeiroId, { status: novoStatus });
      } catch (err) {
        console.error('[DespesasDoEvento] Erro ao atualizar transação:', err);
      }
    }
    const updated = expenses.map(e =>
      e.id === expId ? { ...e, status: novoStatus } : e
    );
    setExpenses(updated);
    saveExpenses(eventId, updated);
  };

  const totalGeral = expenses.reduce((s, e) => s + e.valor, 0);
  const totalPago = expenses.filter(e => e.status === 'Pago').reduce((s, e) => s + e.valor, 0);
  const totalPendente = expenses.filter(e => e.status === 'Pendente').reduce((s, e) => s + e.valor, 0);

  const formatMoeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      {/* Header interno */}
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-neutral-500">
        <Lock size={12} />
        Despesas internas — não aparecem em exportações
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {expenses.length === 0 && (
          <div className="text-center py-6 text-neutral-500 text-xs italic">
            Nenhuma despesa interna cadastrada.
          </div>
        )}
        {expenses.map(exp => (
          <div key={exp.id} className="bg-[#111] border border-[#222] rounded-lg p-3 flex items-start gap-3">
            <button
              type="button"
              onClick={() => toggleStatus(exp.id)}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                exp.status === 'Pago'
                  ? 'bg-[#B5FF03] border-[#B5FF03] text-black'
                  : 'border-neutral-600 hover:border-[#B5FF03]'
              }`}
            >
              {exp.status === 'Pago' && <Check size={10} strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium truncate">{exp.description}</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-neutral-800 text-neutral-300 shrink-0">
                  {exp.category}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-white font-bold">{formatMoeda(exp.valor)}</span>
                {exp.paymentMethod && (
                  <span className="text-[9px] text-neutral-500">{exp.paymentMethod}</span>
                )}
                <span className={`text-[9px] font-bold ${exp.status === 'Pago' ? 'text-[#B5FF03]' : 'text-amber-400'}`}>
                  {exp.status}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(exp.id)}
              className="p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Descrição *</label>
            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none"
              placeholder="Ex: Combustível"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Categoria</label>
              <select
                value={formCat}
                onChange={e => setFormCat(e.target.value as EventExpense['category'])}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Valor (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formValor}
                onChange={e => setFormValor(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none"
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as EventExpense['status'])}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none"
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Forma de Pagamento</label>
              <select
                value={formPayment}
                onChange={e => setFormPayment(e.target.value as EventExpense['paymentMethod'] | '')}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none"
              >
                <option value="">—</option>
                {PAYMENT_METHODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formDesc.trim() || !formValor}
              className="px-4 py-2 bg-[#B5FF03] text-black font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-neutral-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-[10px] font-bold text-[#B5FF03] hover:text-white transition-colors"
        >
          <Plus size={12} />
          Adicionar Despesa
        </button>
      )}

      {/* Totais */}
      {expenses.length > 0 && (
        <div className="border-t border-[#222] pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Total Geral</span>
            <span className="text-white font-bold">{formatMoeda(totalGeral)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Total Pago</span>
            <span className="text-[#B5FF03] font-bold">{formatMoeda(totalPago)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Total Pendente</span>
            <span className="text-amber-400 font-bold">{formatMoeda(totalPendente)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
