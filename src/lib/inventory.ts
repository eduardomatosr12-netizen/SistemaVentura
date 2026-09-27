import {
  collection, getDocs, updateDoc, doc, query, orderBy, onSnapshot, Timestamp, writeBatch, runTransaction,
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

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const inventoryChangeListeners: Set<() => void> = new Set();

export const subscribeInventoryChanges = (callback: () => void): (() => void) => {
  inventoryChangeListeners.add(callback);
  return () => inventoryChangeListeners.delete(callback);
};

let lastBoards: InventoryBoard[] = [];

export const subscribeInventory = (onUpdate?: () => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const unsubscribe = onSnapshot(q, snapshot => {
    lastBoards = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
    onUpdate?.();
    inventoryChangeListeners.forEach(cb => cb());
  }, err => {
    console.error('[Firestore] Erro no listener de inventário:', err);
  });
  return unsubscribe;
};

export const getBoards = (): InventoryBoard[] => lastBoards;

export const subscribeInventoryBoards = (onData: (boards: InventoryBoard[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const boards = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
    lastBoards = boards;
    onData(boards);
  }, err => {
    console.error('[Firestore] Erro no listener de inventário:', err);
  });
  return unsubscribe;
};

export const updateBoard = async (id: string, board: Partial<InventoryBoard>): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...board,
      updatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar board:', err);
    throw err;
  }
};

export const findInventoryItem = (itemName: string): InventoryItemInfo | null => {
  if (!lastBoards) return null;
  const normalizedSearch = normalizeString(itemName);
  for (const board of lastBoards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (normalizeString(name) === normalizedSearch) {
        return { row, board, itemName: name, currentQty: Number(row.values['col-3']) || 0 };
      }
    }
  }
  return null;
};

export const findInventoryItemByRowId = (rowId: string): InventoryItemInfo | null => {
  if (!lastBoards) return null;
  for (const board of lastBoards) {
    for (const row of board.rows) {
      if (row.id === rowId) {
        const name = String(row.values['col-1'] || '');
        return { row, board, itemName: name, currentQty: Number(row.values['col-3']) || 0 };
      }
    }
  }
  return null;
};

export const findInventoryItemByEventStockId = async (eventStockId: string): Promise<InventoryItemInfo | null> => {
  try {
    const { fetchEventStock } = await import('../services/eventStockService');
    const stockItems = await fetchEventStock();
    const stockItem = stockItems.find(item => item.id === eventStockId);
    if (!stockItem) return null;
    return findInventoryItem(stockItem.name);
  } catch {
    return null;
  }
};

export const getAvailableQuantity = (itemName: string, _eventDate: string): number => {
  void _eventDate; // reserved for future date-based availability checks
  const info = findInventoryItem(itemName);
  if (!info) return 0;
  return Math.max(0, info.currentQty);
};

export const deductInventory = async (itemName: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    const normalizedSearch = normalizeString(itemName);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        const name = String(rows[i].values['col-1'] || '');
        if (normalizeString(name) === normalizedSearch) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(doc(db, COLLECTION, boardDoc.id));
            if (!freshDoc.exists()) return;
            const freshRows: InventoryRow[] = freshDoc.data().rows || [];
            const current = Number(freshRows[i]?.values?.['col-3']) || 0;
            freshRows[i] = {
              ...freshRows[i],
              values: { ...freshRows[i].values, 'col-3': Math.max(0, current - quantity) },
            };
            transaction.update(doc(db, COLLECTION, boardDoc.id), {
              rows: freshRows,
              updatedAt: Timestamp.now(),
            });
            console.log(`[Inventory] Deduzido ${quantity} de "${itemName}". Novo saldo: ${Math.max(0, current - quantity)}`);
          });
          return;
        }
      }
    }
    console.warn(`[Inventory] Item "${itemName}" não encontrado para dedução`);
  } catch (err) {
    console.error(`[Firestore] Erro ao deduzir inventário de "${itemName}":`, err);
    throw err;
  }
};

export const deductInventoryByRowId = async (rowId: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === rowId) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(doc(db, COLLECTION, boardDoc.id));
            if (!freshDoc.exists()) return;
            const freshRows: InventoryRow[] = freshDoc.data().rows || [];
            const current = Number(freshRows[i]?.values?.['col-3']) || 0;
            freshRows[i] = {
              ...freshRows[i],
              values: { ...freshRows[i].values, 'col-3': Math.max(0, current - quantity) },
            };
            transaction.update(doc(db, COLLECTION, boardDoc.id), {
              rows: freshRows,
              updatedAt: Timestamp.now(),
            });
            const name = String(freshRows[i].values['col-1'] || '');
            console.log(`[Inventory] Deduzido ${quantity} de "${name}" (rowId: ${rowId}). Novo saldo: ${Math.max(0, current - quantity)}`);
          });
          return;
        }
      }
    }
    console.warn(`[Inventory] Item com rowId "${rowId}" não encontrado para dedução`);
  } catch (err) {
    console.error(`[Firestore] Erro ao deduzir inventário por rowId "${rowId}":`, err);
    throw err;
  }
};

export const deductInventoryByEventStockId = async (eventStockId: string, quantity: number): Promise<void> => {
  const info = await findInventoryItemByEventStockId(eventStockId);
  if (!info) {
    console.warn(`[Inventory] Item com eventStockId "${eventStockId}" não encontrado para dedução`);
    return;
  }
  await deductInventoryByRowId(info.row.id, quantity);
};

export const restoreInventory = async (itemName: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    const normalizedSearch = normalizeString(itemName);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        const name = String(rows[i].values['col-1'] || '');
        if (normalizeString(name) === normalizedSearch) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(doc(db, COLLECTION, boardDoc.id));
            if (!freshDoc.exists()) return;
            const freshRows: InventoryRow[] = freshDoc.data().rows || [];
            const current = Number(freshRows[i]?.values?.['col-3']) || 0;
            freshRows[i] = {
              ...freshRows[i],
              values: { ...freshRows[i].values, 'col-3': current + quantity },
            };
            transaction.update(doc(db, COLLECTION, boardDoc.id), {
              rows: freshRows,
              updatedAt: Timestamp.now(),
            });
            console.log(`[Inventory] Restaurado ${quantity} de "${itemName}". Novo saldo: ${current + quantity}`);
          });
          return;
        }
      }
    }
    console.warn(`[Inventory] Item "${itemName}" não encontrado para restauração`);
  } catch (err) {
    console.error(`[Firestore] Erro ao restaurar inventário de "${itemName}":`, err);
    throw err;
  }
};

export const restoreInventoryByRowId = async (rowId: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === rowId) {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(doc(db, COLLECTION, boardDoc.id));
            if (!freshDoc.exists()) return;
            const freshRows: InventoryRow[] = freshDoc.data().rows || [];
            const current = Number(freshRows[i]?.values?.['col-3']) || 0;
            freshRows[i] = {
              ...freshRows[i],
              values: { ...freshRows[i].values, 'col-3': current + quantity },
            };
            transaction.update(doc(db, COLLECTION, boardDoc.id), {
              rows: freshRows,
              updatedAt: Timestamp.now(),
            });
            const name = String(freshRows[i].values['col-1'] || '');
            console.log(`[Inventory] Restaurado ${quantity} de "${name}" (rowId: ${rowId}). Novo saldo: ${current + quantity}`);
          });
          return;
        }
      }
    }
    console.warn(`[Inventory] Item com rowId "${rowId}" não encontrado para restauração`);
  } catch (err) {
    console.error(`[Firestore] Erro ao restaurar inventário por rowId "${rowId}":`, err);
    throw err;
  }
};

export const restoreInventoryByEventStockId = async (eventStockId: string, quantity: number): Promise<void> => {
  const info = await findInventoryItemByEventStockId(eventStockId);
  if (!info) {
    console.warn(`[Inventory] Item com eventStockId "${eventStockId}" não encontrado para restauração`);
    return;
  }
  await restoreInventoryByRowId(info.row.id, quantity);
};

export const saveBoards = async (boards: InventoryBoard[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    for (const board of boards) {
      const ref = doc(db, COLLECTION, board.id);
      batch.set(ref, {
        title: board.title, color: board.color, columns: board.columns, rows: board.rows, updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  } catch (err) {
    console.error('[Inventory] Erro ao salvar boards:', err);
    throw err;
  }
};

export const getAllInventoryItems = (): { name: string; qty: number; category: string; valorUnit: number }[] => {
  if (!lastBoards) return [];
  const items: { name: string; qty: number; category: string; valorUnit: number }[] = [];
  for (const board of lastBoards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (!name) continue;
      items.push({
        name, qty: Number(row.values['col-3']) || 0,
        category: String(row.values['col-2'] || board.title),
        valorUnit: Number(row.values['col-7']) || 0,
      });
    }
  }
  return items;
};


