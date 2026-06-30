import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, getDocs, onSnapshot, Timestamp, where,
} from 'firebase/firestore';
import { db } from './firebase';

export interface FinanceRecord {
  id?: string;
  type: 'receita' | 'despesa';
  client?: string;
  description: string;
  amount: number;
  date: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'evento' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  category?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION = 'transacoes';

const sortByDateDesc = (records: FinanceRecord[]): FinanceRecord[] =>
  records.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

const mapTransacaoDoc = (d: { id: string; data: () => Record<string, unknown> }): FinanceRecord => ({
  id: d.id,
  ...d.data(),
}) as FinanceRecord;

export const subscribeTransactions = (callback: (records: FinanceRecord[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION));
  const unsubscribe = onSnapshot(q, snapshot => {
    const records = snapshot.docs.map(mapTransacaoDoc);
    callback(sortByDateDesc(records));
  }, err => {
    console.error('[Firestore] Erro no listener de transações (tentando fallback):', err);
    fetchTransactions().then(callback).catch(e => console.error('[Firestore] Fallback também falhou:', e));
  });
  return unsubscribe;
};

export const fetchTransactions = async (): Promise<FinanceRecord[]> => {
  const q = query(collection(db, COLLECTION));
  const snapshot = await getDocs(q);
  return sortByDateDesc(snapshot.docs.map(mapTransacaoDoc));
};

export const addTransaction = async (record: Omit<FinanceRecord, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...record,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateTransaction = async (id: string, fields: Partial<FinanceRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const getTransactionByEventId = async (eventId: string): Promise<FinanceRecord | null> => {
  const q = query(collection(db, COLLECTION), where('origemEventoId', '==', eventId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { id: snapshot.docs[0].id, ...data } as FinanceRecord;
};

const STORAGE_KEY_INVOICES = 'axium_finance_v1';
const STORAGE_KEY_EXPENSES = 'axium_expenses_v1';

interface StoredInvoice {
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

interface StoredExpense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  status: 'Pago' | 'Pendente' | 'Cancelado';
  lastModifiedBy?: string;
}

const parseBRL = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
};

export const migrateLocalStorageToFirestore = async (): Promise<{ invoices: number; expenses: number }> => {
  let invoicesMigrated = 0;
  let expensesMigrated = 0;

  try {
    const storedInvoices = localStorage.getItem(STORAGE_KEY_INVOICES);
    if (storedInvoices) {
      const parsed = JSON.parse(storedInvoices);
      const manualInvoices: StoredInvoice[] = parsed.manualInvoices ?? parsed ?? [];
      for (const inv of manualInvoices) {
        await addTransaction({
          type: 'receita',
          client: inv.client,
          description: `Fatura: ${inv.client}`,
          amount: parseBRL(inv.amount),
          date: inv.date,
          status: inv.status,
          source: inv.source === 'asaas' ? 'asaas' : 'manual',
          paymentMethod: inv.paymentMethod || 'pix',
          installments: inv.installments,
          lastModifiedBy: inv.lastModifiedBy || 'Migração',
        });
        invoicesMigrated++;
      }
      localStorage.removeItem(STORAGE_KEY_INVOICES);
    }
  } catch (err) {
    console.error('[Finance] Erro na migração de faturas:', err);
  }

  try {
    const storedExpenses = localStorage.getItem(STORAGE_KEY_EXPENSES);
    if (storedExpenses) {
      const expenses: StoredExpense[] = JSON.parse(storedExpenses);
      for (const exp of expenses) {
        await addTransaction({
          type: 'despesa',
          description: exp.description,
          category: exp.category,
          amount: parseBRL(exp.amount),
          date: exp.date,
          status: exp.status === 'Cancelado' ? 'Cancelado' : exp.status,
          source: 'manual',
          lastModifiedBy: exp.lastModifiedBy || 'Migração',
        });
        expensesMigrated++;
      }
      localStorage.removeItem(STORAGE_KEY_EXPENSES);
    }
  } catch (err) {
    console.error('[Finance] Erro na migração de despesas:', err);
  }

  return { invoices: invoicesMigrated, expenses: expensesMigrated };
};
