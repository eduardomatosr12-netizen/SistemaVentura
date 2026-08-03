import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface EventItem {
  id: string;
  name: string;
  category: string;
  valorUnit: number;
}

const COLLECTION = 'event_items';

const mapEventItemDoc = (d: { id: string; data: () => Record<string, unknown> }): EventItem => {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    category: String(data.category || ''),
    valorUnit: Number(data.valorUnit) || 0,
  };
};

const sortByName = (items: EventItem[]): EventItem[] =>
  items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export const subscribeEventItems = (callback: (items: EventItem[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const unsubscribe = onSnapshot(q, snapshot => {
    callback(sortByName(snapshot.docs.map(mapEventItemDoc)));
  }, err => {
    console.error('[Firestore] Erro no listener de itens de eventos:', err);
  });
  return unsubscribe;
};

export const fetchEventItems = async (): Promise<EventItem[]> => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return sortByName(snapshot.docs.map(mapEventItemDoc));
};

export const addEventItem = async (item: Omit<EventItem, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...item,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Item de evento criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar item de evento:', err);
    throw err;
  }
};

export const updateEventItem = async (id: string, fields: Partial<Omit<EventItem, 'id'>>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
    console.log('[Firestore] Item de evento atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar item de evento:', id, err);
    throw err;
  }
};

export const deleteEventItem = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Item de evento excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir item de evento:', id, err);
    throw err;
  }
};
