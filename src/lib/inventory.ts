import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, onSnapshot, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateUUID } from './uuid';

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

export const ensureDefaultBoards = async (): Promise<void> => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    const board = createDefaultBoard();
    await addDoc(collection(db, COLLECTION), {
      ...board,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
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
  for (const board of lastBoards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        return { row, board, itemName: name, currentQty: Number(row.values['col-3']) || 0 };
      }
    }
  }
  return null;
};

export const getAvailableQuantity = (_itemName: string, _eventDate: string): number => {
  const info = findInventoryItem(_itemName);
  if (!info) return 0;
  return Math.max(0, info.currentQty);
};

export const deductInventory = async (itemName: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        const name = String(rows[i].values['col-1'] || '');
        if (name.toLowerCase() === itemName.toLowerCase()) {
          const current = Number(rows[i].values['col-3']) || 0;
          rows[i] = {
            ...rows[i],
            values: { ...rows[i].values, 'col-3': Math.max(0, current - quantity) },
          };
          await updateDoc(doc(db, COLLECTION, boardDoc.id), {
            rows,
            updatedAt: Timestamp.now(),
          });
          console.log(`[Inventory] Deduzido ${quantity} de "${itemName}". Novo saldo: ${Math.max(0, current - quantity)}`);
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

export const restoreInventory = async (itemName: string, quantity: number): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    for (const boardDoc of snapshot.docs) {
      const data = boardDoc.data();
      const rows: InventoryRow[] = data.rows || [];
      for (let i = 0; i < rows.length; i++) {
        const name = String(rows[i].values['col-1'] || '');
        if (name.toLowerCase() === itemName.toLowerCase()) {
          const current = Number(rows[i].values['col-3']) || 0;
          rows[i] = {
            ...rows[i],
            values: { ...rows[i].values, 'col-3': current + quantity },
          };
          await updateDoc(doc(db, COLLECTION, boardDoc.id), {
            rows,
            updatedAt: Timestamp.now(),
          });
          console.log(`[Inventory] Restaurado ${quantity} de "${itemName}". Novo saldo: ${current + quantity}`);
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

export const DEFAULT_INVENTORY_ROWS: InventoryRow[] = [
  { id: '', values: { 'col-1': 'Painel de Led P3.9 LPS Curvo (50x100)', 'col-2': 'Painel de LED', 'col-3': 9, 'col-4': 18, 'col-5': 'LPG', 'col-6': '', 'col-7': 75, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Par Led 60 Led 3w Rgb Triled', 'col-2': 'Iluminação', 'col-3': 49, 'col-4': 50, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Varal de Lampada Comum (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 200, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Varal de Lampada Japonesa (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 300, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Som - Medio', 'col-2': 'Som', 'col-3': 2, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Som - Grave', 'col-2': 'Som', 'col-3': 1, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Som Completo (Banda)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 750, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Som Completo (DJ/Evento)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 400, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Piso Palco Praticáveis (100x200x)', 'col-2': 'Estrutura', 'col-3': 9, 'col-4': 9, 'col-5': 'Pernambuco Estruturas', 'col-6': '', 'col-7': 80, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Cabine Fotografica Infinite', 'col-2': 'Outros', 'col-3': 1, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 500, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Seta de Led', 'col-2': 'Iluminação', 'col-3': 5, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 200, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Totem de Led P3.9 (100x200)', 'col-2': 'Painel de LED', 'col-3': 40, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 300, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Piso Paris Galáxia', 'col-2': 'Estrutura', 'col-3': 1, 'col-4': 16, 'col-5': 'Milleto', 'col-6': '', 'col-7': 50, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Moving Beem 14R LPG', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 150, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Refletor Holofote Super Led 50w - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 0, 'col-5': 'Ipojuca - Caruaru', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Refletor Par 38', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 20, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Refletor Holofote Led 30W - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 24, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Refletor Holofote Led 30W - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 12, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Refletor Holofote Led 200w - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 30, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Gride Alumínio P25 (Mt)', 'col-2': 'Estrutura', 'col-3': 0, 'col-4': 40, 'col-5': 'One Light', 'col-6': '', 'col-7': 30, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Show DJ', 'col-2': 'Som', 'col-3': 0, 'col-4': 1, 'col-5': 'Ventura', 'col-6': '', 'col-7': 800, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Jatos CO2', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 4, 'col-5': 'Pirulito Recife', 'col-6': '', 'col-7': 400, 'col-8': 0 } },
  { id: '', values: { 'col-1': 'Efeitos Pirotécnicos', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 10, 'col-5': 'Casa do Fogueteiro - Caruaru', 'col-6': '', 'col-7': 0, 'col-8': 0 } },
];

function createDefaultBoard(): Omit<InventoryBoard, 'id'> {
  const rows = DEFAULT_INVENTORY_ROWS.map(r => ({ ...r, id: generateUUID() }));
  return {
    title: 'Inventário de Itens',
    color: '#3b82f6',
    columns: [
      { id: 'col-1', title: 'ITEM', type: 'text', width: 250 },
      { id: 'col-2', title: 'CATEGORIA', type: 'status', width: 150 },
      { id: 'col-3', title: 'QTD. ATUAL', type: 'number', width: 140 },
      { id: 'col-4', title: 'ESTOQUE', type: 'number', width: 130 },
      { id: 'col-5', title: 'FORNECEDOR', type: 'text', width: 200 },
      { id: 'col-6', title: 'ÚLTIMA ENTRADA', type: 'date', width: 130 },
      { id: 'col-7', title: 'VALOR UNIT.', type: 'number', width: 120 },
      { id: 'col-8', title: 'VALOR CUSTO UNIT.', type: 'number', width: 140 },
    ],
    rows,
  };
}
