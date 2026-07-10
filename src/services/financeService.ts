import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDocs, onSnapshot, Timestamp, where,
} from 'firebase/firestore';
import { db } from './firebase';

export interface FinanceRecord {
  id?: string;
  type: 'receita' | 'despesa';
  client?: string;
  description: string;
  amount: number;
  date: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'evento' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  category?: string;
  eventType?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
  expenseType?: 'fixa' | 'variavel';
  recurrence?: 'mensal' | 'trimestral' | 'anual';
  dueDay?: number;
  parentId?: string;
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
  const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const records = snapshot.docs.map(mapTransacaoDoc);
    callback(sortByDateDesc(records));
  }, err => {
    console.error('[Firestore] Erro no listener de transações:', err);
  });
  return unsubscribe;
};

export const fetchTransactions = async (): Promise<FinanceRecord[]> => {
  const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return sortByDateDesc(snapshot.docs.map(mapTransacaoDoc));
};

export const addTransaction = async (record: Omit<FinanceRecord, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...record,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Transação criada:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar transação:', err);
    throw err;
  }
};

export const updateTransaction = async (id: string, fields: Partial<FinanceRecord>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
    console.log('[Firestore] Transação atualizada:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar transação:', id, err);
    throw err;
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Transação excluída:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir transação:', id, err);
    throw err;
  }
};

export const getTransactionByEventId = async (eventId: string): Promise<FinanceRecord | null> => {
  const q = query(collection(db, COLLECTION), where('origemEventoId', '==', eventId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { id: snapshot.docs[0].id, ...data } as FinanceRecord;
};


