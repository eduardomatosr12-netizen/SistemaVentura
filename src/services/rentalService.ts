import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDocs, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface RentalItem {
  id: string;
  item: string;
  status: 'Em Trânsito' | 'Montado' | 'Devolvido';
  quantidade: number;
}

export interface RentalRecord {
  id?: string;
  client: string;
  dataSaida: string;
  dataDevolucao: string;
  items: RentalItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION = 'rentals';

export const subscribeRentals = (callback: (records: RentalRecord[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('dataSaida', 'desc'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const records = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as RentalRecord[];
    callback(records);
  }, err => console.error('[Firestore] Erro no listener de aluguéis:', err));
  return unsubscribe;
};

export const fetchRentals = async (): Promise<RentalRecord[]> => {
  const q = query(collection(db, COLLECTION), orderBy('dataSaida', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as RentalRecord[];
};

export const addRental = async (record: Omit<RentalRecord, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...record,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Aluguel criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar aluguel:', err);
    throw err;
  }
};

export const updateRental = async (id: string, fields: Partial<RentalRecord>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
    console.log('[Firestore] Aluguel atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar aluguel:', id, err);
    throw err;
  }
};

export const deleteRental = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Aluguel excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir aluguel:', id, err);
    throw err;
  }
};
