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
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...record,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateRental = async (id: string, fields: Partial<RentalRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
};

export const deleteRental = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
