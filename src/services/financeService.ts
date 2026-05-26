import { collection, addDoc, Timestamp } from 'firebase/firestore';
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
