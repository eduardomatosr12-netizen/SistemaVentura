import { generateUUID } from './uuid';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, onSnapshot, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';

export interface InventoryColumn {
  id: string;
  title: string;
  type: string;
  width: number;
}

export interface InventoryRow {
  id: string;
  values: Record<string, unknown>;
}

export interface InventoryBoard {
  id: string;
  title: string;
  color: string;
  columns: InventoryColumn[];
  rows: InventoryRow[];
}

export interface InventoryItemInfo {
  row: InventoryRow;
  board: InventoryBoard;
  itemName: string;
  currentQty: number;
}

const COLLECTION = 'inventory_boards';
const ORCAMENTOS_COLLECTION = 'leads';
const EVENTS_COLLECTION = 'events';
const STAGE_FECHADO = 'Contrato Fechado';

let boardsCache: InventoryBoard[] | null = null;
let reservedCache: Map<string, number> = new Map();
let reservedCacheDate = '';

export const loadInventory = async (): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    boardsCache = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
  } catch {
    boardsCache = [];
  }
};

export const subscribeInventory = (onUpdate?: () => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const unsubscribe = onSnapshot(q, snapshot => {
    boardsCache = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
    onUpdate?.();
  }, err => console.error('[Firestore] Erro no listener de inventário:', err));
  return unsubscribe;
};

export const refreshReservedCache = async (eventDate: string): Promise<void> => {
  if (reservedCacheDate === eventDate && reservedCache.size > 0) return;
  reservedCache = new Map();
  reservedCacheDate = eventDate;
  try {
    const eventsSnap = await getDocs(collection(db, EVENTS_COLLECTION));
    const confirmedClients = new Set<string>();
    eventsSnap.forEach(d => {
      const data = d.data();
      if (data.date === eventDate && (data.status === 'confirmado' || data.status === 'realizado') && data.client) {
        confirmedClients.add(String(data.client).toLowerCase());
      }
    });
    const leadsSnap = await getDocs(collection(db, ORCAMENTOS_COLLECTION));
    leadsSnap.forEach(d => {
      const data = d.data();
      if (data.firstContact !== eventDate || !data.name) return;
      if (!confirmedClients.has(String(data.name).toLowerCase())) return;
      const items = data.items || [];
      for (const item of items) {
        const key = String(item.item || '').toLowerCase();
        reservedCache.set(key, (reservedCache.get(key) || 0) + (Number(item.qtdAtual) || 0));
      }
    });
  } catch {
    // silent
  }
};

export const getBoards = (): InventoryBoard[] => boardsCache || [];

export const saveBoards = async (boards: InventoryBoard[]): Promise<void> => {
  boardsCache = boards;
  try {
    const batch = writeBatch(db);
    for (const board of boards) {
      const ref = doc(db, COLLECTION, board.id);
      batch.set(ref, {
        title: board.title, color: board.color, columns: board.columns, rows: board.rows, updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  } catch {
    // silent
  }
};

export const findInventoryItem = (itemName: string): InventoryItemInfo | null => {
  if (!boardsCache) return null;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        return { row, board, itemName: name, currentQty: Number(row.values['col-3']) || 0 };
      }
    }
  }
  return null;
};

export const getReservedQuantity = (itemName: string, _eventDate: string): number => {
  return reservedCache.get(itemName.toLowerCase()) || 0;
};

export const getAvailableQuantity = (itemName: string, eventDate: string): number => {
  const info = findInventoryItem(itemName);
  if (!info) return 0;
  const reserved = getReservedQuantity(itemName, eventDate);
  return Math.max(0, info.currentQty - reserved);
};

export const deductInventory = async (itemName: string, quantity: number): Promise<void> => {
  if (!boardsCache) return;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = Math.max(0, current - quantity);
        await saveBoards(boardsCache);
        return;
      }
    }
  }
};

export const restoreInventory = async (itemName: string, quantity: number): Promise<void> => {
  if (!boardsCache) return;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = current + quantity;
        await saveBoards(boardsCache);
        return;
      }
    }
  }
};

export const getAllInventoryItems = (): { name: string; qty: number; category: string }[] => {
  if (!boardsCache) return [];
  const items: { name: string; qty: number; category: string }[] = [];
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (!name) continue;
      items.push({
        name, qty: Number(row.values['col-3']) || 0,
        category: String(row.values['col-2'] || board.title),
      });
    }
  }
  return items;
};
