import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface EventStockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  valorReferencia: number;
  observacao: string;
}

export const EVENT_STOCK_CATEGORIES = [
  'Iluminação',
  'Som',
  'Efeitos',
  'Estrutura',
  'Vídeo',
  'Outros',
] as const;

export const EVENT_STOCK_UNITS = [
  'kit',
  'unidade',
  'par',
  'set',
  'metro',
  'outros',
] as const;

export interface EventStockItemInput {
  name: string;
  category: string;
  observacao: string;
  quantity?: number;
  unit?: string;
  valorReferencia?: number;
}

const COLLECTION = 'event_stock';

const mapEventStockDoc = (d: { id: string; data: () => Record<string, unknown> }): EventStockItem => {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    category: String(data.category || ''),
    quantity: Number(data.quantity) || 0,
    unit: String(data.unit || 'unidade'),
    valorReferencia: Number(data.valorReferencia) || 0,
    observacao: String(data.observacao || ''),
  };
};

const sortByName = (items: EventStockItem[]): EventStockItem[] =>
  items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export const subscribeEventStock = (callback: (items: EventStockItem[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const unsubscribe = onSnapshot(q, snapshot => {
    callback(sortByName(snapshot.docs.map(mapEventStockDoc)));
  }, err => {
    console.error('[Firestore] Erro no listener do estoque de eventos:', err);
  });
  return unsubscribe;
};

export const fetchEventStock = async (): Promise<EventStockItem[]> => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return sortByName(snapshot.docs.map(mapEventStockDoc));
};

export const addEventStockItem = async (item: EventStockItemInput): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      name: item.name,
      category: item.category,
      observacao: item.observacao,
      quantity: item.quantity ?? 0,
      unit: item.unit ?? 'unidade',
      valorReferencia: item.valorReferencia ?? 0,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Item do estoque de eventos criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar item do estoque de eventos:', err);
    throw err;
  }
};

export const updateEventStockItem = async (id: string, fields: Partial<Omit<EventStockItem, 'id'>>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
    console.log('[Firestore] Item do estoque de eventos atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar item do estoque de eventos:', id, err);
    throw err;
  }
};

export const deleteEventStockItem = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Item do estoque de eventos excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir item do estoque de eventos:', id, err);
    throw err;
  }
};
