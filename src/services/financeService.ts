import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface FinanceTransaction {
  id?: string;
  client: string;
  description: string;
  amount: number;
  date: string;
  status: 'Pendente' | 'Pago' | 'Vencida' | 'Cancelado';
  type: 'receita' | 'despesa';
  source: 'lead' | 'manual' | 'evento';
  origemEventoId?: string;
  createdAt?: any;
}

const COLLECTION = 'transacoes';

export const addTransaction = async (transaction: Omit<FinanceTransaction, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...transaction,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getTransactionByEventId = async (eventId: string): Promise<FinanceTransaction | null> => {
  const q = query(collection(db, COLLECTION), where('origemEventoId', '==', eventId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { id: snapshot.docs[0].id, ...data } as FinanceTransaction;
};
