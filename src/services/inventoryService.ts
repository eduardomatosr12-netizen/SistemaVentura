import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InventoryBoard } from '../lib/inventory';

const COLLECTION = 'inventory_boards';

export const subscribeInventoryBoards = (callback: (boards: InventoryBoard[]) => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const boards = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
    callback(boards);
  }, err => {
    console.error('[Firestore] Erro no listener de inventário (service):', err);
  });
  return unsubscribe;
};

export const saveInventoryBoard = async (board: Omit<InventoryBoard, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...board,
      updatedAt: Timestamp.now(),
    });
    console.log('[Firestore] Board de inventário criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar board de inventário:', err);
    throw err;
  }
};

export const updateInventoryBoard = async (id: string, board: Partial<InventoryBoard>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { ...board, updatedAt: Timestamp.now() });
    console.log('[Firestore] Board de inventário atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar board de inventário:', err);
    throw err;
  }
};

export const deleteInventoryBoard = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Board de inventário excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir board de inventário:', err);
    throw err;
  }
};
