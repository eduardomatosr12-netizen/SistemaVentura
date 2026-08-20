import { useState, useEffect } from 'react';
import { Plus, Trash2, Lock, Check } from 'lucide-react';
import { addTransaction, updateTransaction, deleteTransaction } from '../services/financeService';
import {
  subscribeEventExpenses, addEventExpense,
  updateEventExpense, deleteEventExpense, setExpenseFinanceiroId,
} from '../services/eventExpenseService';
import type { EventExpense } from '../types/crm';

const CATEGORIES: EventExpense['category'][] = ['Transporte', 'Alimentação', 'Hospedagem', 'Material', 'Equipe', 'Outros'];
const PAYMENT_METHODS: { value: EventExpense['paymentMethod']; label: string }[] = [
  { value: 'Pix', label: 'Pix' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão', label: 'Cartão' },
  { value: 'Boleto', label: 'Boleto' },
];

function notifyFinanceiro() {
  window.dispatchEvent(new CustomEvent('despesas-atualizadas'));
}

interface Props {
  eventId: string | null;
  eventDate?: string;
}

export default function DespesasDoEvento({ eventId, eventDate }: Props) {
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState<EventExpense['category']>('Outros');
  const [formValor, setFormValor] = useState('');
  const [formStatus, setFormStatus] = useState<EventExpense['status']>('Pendente');
  const [formPayment, setFormPayment] = useState<EventExpense['paymentMethod'] | ''>('');

  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeEventExpenses(eventId, (list) => {
      setExpenses(list);
      list.forEach(exp => {
        if (!exp.financeiroId) {
          syncExpenseToFirestore(eventId, exp).then(financeiroId => {
            if (financeiroId && exp.id) {
              setExpenseFinanceiroId(exp.id, financeiroId);
            }
          });
        }
      });
    });
    return () => unsub();
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
        date: eventDate || new Date().toISOString().split('T')[0],
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
    if (!formDesc.trim() || !formValor || !eventId) return;
    const valor = parseFloat(formValor.replace(',', '.')) || 0;
    const expenseData = {
      description: formDesc.trim(),
      category: formCat,
      valor,
      status: formStatus,
      paymentMethod: formPayment ? (formPayment as EventExpense['paymentMethod']) : undefined,
      tipo: 'variavel' as const,
      interno: true as const,
    };

    try {
      const expenseId = await addEventExpense(eventId, expenseData);
      const financeiroId = await syncExpenseToFirestore(eventId, { id: expenseId, ...expenseData, financeiroId: undefined });
      if (financeiroId) {
        await setExpenseFinanceiroId(expenseId, financeiroId);
      }
      notifyFinanceiro();
      resetForm();
    } catch (err) {
      console.error('[DespesasDoEvento] Erro ao adicionar despesa:', err);
    }
  };

  const handleRemove = async (exp: EventExpense) => {
    if (!eventId) return;
    if (exp.financeiroId) {
      try {
        await deleteTransaction(exp.financeiroId);
      } catch (err) {
        console.error('[DespesasDoEvento] Erro ao excluir transação:', err);
        return;
      }
    }
    try {
      if (exp.id) {
        await deleteEventExpense(exp.id);
      }
      notifyFinanceiro();
    } catch (err) {
      console.error('[DespesasDoEvento] Erro ao excluir despesa:', err);
    }
  };

  const toggleStatus = async (exp: EventExpense) => {
    if (!exp.id) return;
    const novoStatus = exp.status === 'Pago' ? 'Pendente' as const : 'Pago' as const;
    if (exp.financeiroId) {
      try {
        await updateTransaction(exp.financeiroId, { status: novoStatus });
      } catch (err) {
        console.error('[DespesasDoEvento] Erro ao atualizar transação:', err);
        return;
      }
    }
    try {
      await updateEventExpense(exp.id, { status: novoStatus });
      notifyFinanceiro();
    } catch (err) {
      console.error('[DespesasDoEvento] Erro ao atualizar despesa:', err);
    }
  };

  const totalGeral = expenses.reduce((s, e) => s + e.valor, 0);
  const totalPago = expenses.filter(e => e.status === 'Pago').reduce((s, e) => s + e.valor, 0);
  const totalPendente = expenses.filter(e => e.status === 'Pendente').reduce((s, e) => s + e.valor, 0);

  const formatMoeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 section-label">
        <Lock size={12} />
        Despesas internas — não aparecem em exportações
      </div>

      <div className="space-y-2">
        {expenses.length === 0 && (
          <div className="text-center py-6 text-[#606060] text-xs italic">
            Nenhuma despesa interna cadastrada.
          </div>
        )}
        {expenses.map(exp => (
          <div key={exp.id} className="card p-3 flex items-start gap-3">
            <button
              type="button"
              onClick={() => toggleStatus(exp)}
              className={`mt-0.5 w-11 h-11 min-w-[44px] min-h-[44px] rounded border flex items-center justify-center shrink-0 transition-colors ${
                exp.status === 'Pago'
                  ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                  : 'border-[rgba(255,255,255,0.2)] hover:border-[#CCFF00]'
              }`}
            >
              {exp.status === 'Pago' && <Check size={14} strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium truncate">{exp.description}</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#222] text-[#A0A0A0] shrink-0">
                  {exp.category}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-sm text-white font-bold">{formatMoeda(exp.valor)}</span>
                {exp.paymentMethod && (
                  <span className="text-[9px] text-[#606060]">{exp.paymentMethod}</span>
                )}
                <span className={`badge ${exp.status === 'Pago' ? 'badge-pago' : 'badge-pendente'}`}>
                  {exp.status}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(exp)}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[#606060] hover:text-[#FF4444] hover:bg-[rgba(255,68,68,0.1)] transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="section-label mb-1 block">Descrição *</label>
            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className="input-field w-full"
              placeholder="Ex: Combustível"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="section-label mb-1 block">Categoria</label>
              <select
                value={formCat}
                onChange={e => setFormCat(e.target.value as EventExpense['category'])}
                className="input-field w-full"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="section-label mb-1 block">Valor (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formValor}
                onChange={e => setFormValor(e.target.value)}
                className="input-field w-full"
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="section-label mb-1 block">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as EventExpense['status'])}
                className="input-field w-full"
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
            <div>
              <label className="section-label mb-1 block">Forma de Pagamento</label>
              <select
                value={formPayment}
                onChange={e => setFormPayment(e.target.value as EventExpense['paymentMethod'] | '')}
                className="input-field w-full"
              >
                <option value="">—</option>
                {PAYMENT_METHODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formDesc.trim() || !formValor}
              className="btn-primary px-4 py-3 min-h-[44px] text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3 min-h-[44px] text-[#A0A0A0] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:text-white transition-colors"
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
          className="flex items-center gap-1.5 text-[10px] font-bold text-[#CCFF00] hover:text-white transition-colors py-2 min-h-[44px]"
        >
          <Plus size={12} />
          Adicionar Despesa
        </button>
      )}

      {expenses.length > 0 && (
        <div className="border-t border-[rgba(255,255,255,0.08)] pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#A0A0A0]">Total Geral</span>
            <span className="text-white font-bold">{formatMoeda(totalGeral)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#A0A0A0]">Total Pago</span>
            <span className="text-[#CCFF00] font-bold">{formatMoeda(totalPago)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#A0A0A0]">Total Pendente</span>
            <span className="text-[#FFB800] font-bold">{formatMoeda(totalPendente)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
