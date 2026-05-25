import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InventoryBoard } from '../lib/inventory';

const COLLECTION = 'inventory_boards';

export const fetchInventoryBoards = async (): Promise<InventoryBoard[]> => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    title: d.data().title || '',
    color: d.data().color || '',
    columns: d.data().columns || [],
    rows: d.data().rows || [],
  })) as InventoryBoard[];
};

export const saveInventoryBoard = async (board: Omit<InventoryBoard, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...board,
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateInventoryBoard = async (id: string, board: Partial<InventoryBoard>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...board, updatedAt: Timestamp.now() });
};

export const deleteInventoryBoard = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const fetchInventoryRows = async (): Promise<{ boardId: string; row: import('../lib/inventory').InventoryRow }[]> => {
  const boards = await fetchInventoryBoards();
  const result: { boardId: string; row: import('../lib/inventory').InventoryRow }[] = [];
  for (const board of boards) {
    for (const row of board.rows) {
      result.push({ boardId: board.id, row });
    }
  }
  return result;
};
