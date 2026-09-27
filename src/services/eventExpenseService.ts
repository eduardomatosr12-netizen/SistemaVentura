import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { EventExpense } from '../types/crm';
import { cleanDataForFirestore } from '../lib/dataCleaner';

const COLLECTION = 'event_expenses';

export interface EventExpenseRecord extends EventExpense {
  eventId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const subscribeEventExpenses = (
  eventId: string,
  callback: (expenses: EventExpenseRecord[]) => void
) => {
  const q = query(
    collection(db, COLLECTION),
    where('eventId', '==', eventId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      ...doc.data() as EventExpenseRecord,
      id: doc.id,
    }));
    callback(list);
  }, (err) => {
    console.error('[EventExpenses] Erro no listener:', err);
  });
};

export const addEventExpense = async (
  eventId: string,
  expense: Omit<EventExpense, 'id' | 'financeiroId'>
): Promise<string> => {
  const cleanExpense = cleanDataForFirestore({
    ...expense,
    eventId,
  } as Record<string, unknown>);
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...cleanExpense,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateEventExpense = async (
  expenseId: string,
  data: Partial<EventExpenseRecord>
) => {
  const cleanData = cleanDataForFirestore(data as Record<string, unknown>);
  await updateDoc(doc(db, COLLECTION, expenseId), {
    ...cleanData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteEventExpense = async (expenseId: string) => {
  await deleteDoc(doc(db, COLLECTION, expenseId));
};

export const setExpenseFinanceiroId = async (
  expenseId: string,
  financeiroId: string
) => {
  await updateDoc(doc(db, COLLECTION, expenseId), {
    financeiroId,
    updatedAt: Timestamp.now(),
  });
};
